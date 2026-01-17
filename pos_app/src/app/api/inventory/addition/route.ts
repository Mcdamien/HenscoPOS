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

    // Use provided referenceId as additionId if format is INV-YYYYMM-XXX
    // Otherwise generate a sequential ID
    let additionId: number
    let savedReferenceId: string | null = referenceId || null

    if (referenceId && referenceId.startsWith('INV-')) {
      // Parse the reference ID to get the sequential number
      const parts = referenceId.split('-')
      if (parts.length === 3 && parts[2]) {
        additionId = parseInt(parts[2], 10)
        if (isNaN(additionId)) {
          // Fallback to sequential ID
          const lastAddition = await db.inventoryAddition.findFirst({
            orderBy: { additionId: 'desc' }
          })
          additionId = lastAddition ? lastAddition.additionId + 1 : 1001
        }
      } else {
        const lastAddition = await db.inventoryAddition.findFirst({
          orderBy: { additionId: 'desc' }
        })
        additionId = lastAddition ? lastAddition.additionId + 1 : 1001
      }
    } else {
      // Generate a new reference ID in INV-YYYYMM-XXX format
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const lastAddition = await db.inventoryAddition.findFirst({
        orderBy: { additionId: 'desc' }
      })
      const seq = lastAddition ? lastAddition.additionId + 1 : 1001
      savedReferenceId = `INV-${year}${month}-${String(seq).padStart(3, '0')}`
      additionId = seq
    }

    // Use a transaction to ensure atomicity
    const result = await db.$transaction(async (tx: any) => {
      let totalCost = 0
      const processedItems = []

      for (const item of items) {
        const { name, cost, price, stock } = item
        const numCost = parseFloat(cost)
        const numPrice = parseFloat(price)
        const numQty = parseInt(stock)
        totalCost += numCost * numQty

        // 1. Find or create the product
        let product = await tx.product.findFirst({
          where: { name: { contains: name } }
        })

        if (product) {
          // Update existing product
          product = await tx.product.update({
            where: { id: product.id },
            data: {
              cost: numCost,
              price: numPrice,
              warehouseStock: {
                increment: numQty
              }
            }
          })
        } else {
          // Create new product
          const lastProduct = await tx.product.findFirst({
            orderBy: { itemId: 'desc' }
          })
          const nextItemId = lastProduct ? lastProduct.itemId + 1 : 101

          product = await tx.product.create({
            data: {
              itemId: nextItemId,
              name,
              cost: numCost,
              price: numPrice,
              warehouseStock: numQty
            }
          })
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
      const addition = await tx.inventoryAddition.create({
        data: {
          additionId: additionId,
          referenceId: savedReferenceId,
          totalCost: totalCost,
          items: {
            create: processedItems
          }
        },
        include: {
          items: true
        }
      })

      // 3. Accounting Entries
      // Debit Inventory (1030), Credit Accounts Payable (2010)
      const inventoryAccount = await tx.account.findUnique({ where: { code: '1030' } })
      const apAccount = await tx.account.findUnique({ where: { code: '2010' } })

      if (inventoryAccount && apAccount && totalCost > 0) {
        // Generate entry number
        const lastEntry = await tx.journalEntry.findFirst({
          orderBy: { entryNumber: 'desc' }
        })
        const lastNum = lastEntry ? parseInt(lastEntry.entryNumber.replace('JE', '')) : 0
        const entryNumber = `JE${(lastNum + 1).toString().padStart(6, '0')}`

        await tx.journalEntry.create({
          data: {
            entryNumber,
            date: new Date(),
            description: `Inventory addition #${additionId} (Ref: ${savedReferenceId})`,
            isPosted: true,
            lines: {
              create: [
                { accountId: inventoryAccount.id, description: `Stock increase`, debit: totalCost, credit: 0 },
                { accountId: apAccount.id, description: `Payable for stock`, debit: 0, credit: totalCost },
              ]
            }
          }
        })

        // Update balances
        await tx.account.update({
          where: { id: inventoryAccount.id },
          data: { balance: { increment: totalCost } }
        })
        await tx.account.update({
          where: { id: apAccount.id },
          data: { balance: { increment: totalCost } }
        })
      }

      return addition
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Failed to process inventory addition:', error) // Log the error details
    return NextResponse.json({ error: 'Failed to process inventory addition' }, { status: 500 })
  }
}

