import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const additions = await db.inventoryAddition.findMany({
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })
    return NextResponse.json(additions)
  } catch (error) {
    console.error('Failed to fetch inventory additions:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory additions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received payload:', body) // Log the incoming payload

    const { items, referenceId } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('Validation failed: At least one item is required')
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Use a transaction to ensure atomicity
    const result = await db.$transaction(async (tx: any) => {
      // 1. Determine additionId inside transaction to avoid races
      let currentAdditionId = 1001
      try {
        const lastAddition = await tx.inventoryAddition.findFirst({
          orderBy: { additionId: 'desc' }
        })
        currentAdditionId = lastAddition ? lastAddition.additionId + 1 : 1001
      } catch (e) {
        console.error('Error finding last addition:', e)
      }

      // If referenceId was passed in INV-YYYYMM-XXX format, try to extract sequence
      if (referenceId && referenceId.startsWith('INV-')) {
        const parts = referenceId.split('-')
        if (parts.length === 3 && parts[2]) {
          const parsedId = parseInt(parts[2], 10)
          if (!isNaN(parsedId)) {
            currentAdditionId = parsedId
          }
        }
      }

      let totalCost = 0
      const processedItems: any[] = []

      for (const item of items) {
        const { name, cost, price, stock } = item
        
        // STRICT VALIDATION: Ensure numbers are actually numbers
        const numCost = isNaN(parseFloat(cost)) ? 0 : parseFloat(cost)
        const numPrice = isNaN(parseFloat(price)) ? 0 : parseFloat(price)
        const numQty = isNaN(parseInt(stock)) ? 0 : parseInt(stock)
        
        if (!name) continue
        
        totalCost += numCost * numQty

        // 1. Find or create the product
        let product = await tx.product.findFirst({
          where: { name: { equals: name.trim() } }
        })

        if (product) {
          // Update existing product
          product = await tx.product.update({
            where: { id: product.id },
            data: {
              cost: numCost > 0 ? numCost : product.cost,
              price: numPrice > 0 ? numPrice : product.price,
              warehouseStock: {
                increment: numQty
              }
            }
          })
        } else {
          // Create new product
          let created = false
          let attempts = 0
          while (!created && attempts < 5) {
            const lastProduct = await tx.product.findFirst({
              orderBy: { itemId: 'desc' }
            })
            const nextItemId = lastProduct ? lastProduct.itemId + 1 : 101

            try {
              product = await tx.product.create({
                data: {
                  itemId: nextItemId,
                  name,
                  cost: numCost,
                  price: numPrice,
                  warehouseStock: numQty
                }
              })
              created = true
            } catch (createErr: any) {
              if (createErr.code === 'P2002' && (createErr.meta?.target?.includes('itemId') || createErr.meta?.target?.includes('name'))) {
                // If it's a name conflict that happened between findFirst and create
                if (createErr.meta?.target?.includes('name')) {
                  product = await tx.product.findFirst({ where: { name: { equals: name } } })
                  if (product) {
                    product = await tx.product.update({
                      where: { id: product.id },
                      data: {
                        cost: numCost,
                        price: numPrice,
                        warehouseStock: { increment: numQty }
                      }
                    })
                    created = true
                    break
                  }
                }
                attempts++
                continue
              }
              throw createErr
            }
          }
          if (!created) throw new Error(`Failed to create/update product "${name}" after multiple attempts`)
        }

        processedItems.push({
          productId: product.id,
          itemName: product.name,
          cost: numCost,
          price: numPrice,
          qty: numQty
        } as any); // Temporarily cast to `any` to resolve type mismatch
      }

      // 2. Create the InventoryAddition record
      // Ensure we have a valid referenceId
      let finalReferenceId = referenceId
      if (!finalReferenceId || !finalReferenceId.startsWith('INV-')) {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        finalReferenceId = `INV-${year}${month}-${String(currentAdditionId).padStart(3, '0')}`
      }

      // Retry mechanism for additionId conflict
      let saved = false
      let saveAttempts = 0
      let finalAddition: any = null
      
      while (!saved && saveAttempts < 3) {
        try {
          finalAddition = await tx.inventoryAddition.create({
            data: {
              additionId: currentAdditionId,
              referenceId: finalReferenceId,
              totalCost: totalCost,
              items: {
                create: processedItems
              }
            },
            include: {
              items: true
            }
          })
          saved = true
        } catch (saveErr: any) {
          if (saveErr.code === 'P2002') {
            currentAdditionId++ // Increment and try again
            const now = new Date()
            finalReferenceId = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(currentAdditionId).padStart(3, '0')}`
            saveAttempts++
            continue
          }
          throw saveErr
        }
      }
      return finalAddition
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Failed to process inventory addition:', error) // Log the error details
    return NextResponse.json({ error: 'Failed to process inventory addition' }, { status: 500 })
  }
}

