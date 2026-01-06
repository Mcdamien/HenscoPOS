import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const maxDuration = 60 // Increase timeout to 60 seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products)) {
      console.error('Bulk upload failed: Products is not an array', body)
      return NextResponse.json({ error: 'Products must be an array' }, { status: 400 })
    }

    const results = {
      created: 0,
      updated: 0,
      errors: 0
    }

    console.log(`Processing bulk upload for ${products.length} products`)
    if (products.length > 0) {
      console.log('Sample product:', products[0])
    }

    for (const item of products) {
      try {
        const { name, cost, price, stock } = item

        if (!name) {
          console.warn('Skipping item with no name:', item)
          results.errors++
          continue
        }

        // Normalize inputs immediately
        const normalizedCost = (cost !== null && cost !== undefined && !isNaN(parseFloat(cost))) ? parseFloat(cost) : null
        const normalizedPrice = (price !== null && price !== undefined && !isNaN(parseFloat(price))) ? parseFloat(price) : null
        const normalizedStock = (stock !== null && stock !== undefined && !isNaN(parseInt(stock))) ? parseInt(stock) : 0

        // Use findFirst but consider case-insensitive search if needed
        // For SQLite, we just do exact match for now as per previous logic
        const existingProduct = await db.product.findFirst({
          where: { name: { equals: name } }
        })

        if (existingProduct) {
          await db.product.update({
            where: { id: existingProduct.id },
            data: {
              cost: normalizedCost !== null ? normalizedCost : existingProduct.cost,
              price: normalizedPrice !== null ? normalizedPrice : existingProduct.price,
              warehouseStock: {
                increment: normalizedStock
              }
            }
          })
          results.updated++
        } else {
          // Robust itemId generation: find the current max inside the loop or use a retry mechanism
          // This is still not 100% atomic in SQLite without a transaction, but better than calculating once at the start
          let created = false
          let attempts = 0
          while (!created && attempts < 3) {
            const lastProduct = await db.product.findFirst({
              orderBy: { itemId: 'desc' }
            })
            const nextItemId = lastProduct ? lastProduct.itemId + 1 : 101

            try {
              await db.product.create({
                data: {
                  itemId: nextItemId,
                  name,
                  cost: normalizedCost !== null ? normalizedCost : 0,
                  price: normalizedPrice !== null ? normalizedPrice : 0,
                  warehouseStock: normalizedStock
                }
              })
              created = true
              results.created++
            } catch (createErr: any) {
              // If it's a unique constraint error on itemId, try again
              if (createErr.code === 'P2002' && createErr.meta?.target?.includes('itemId')) {
                attempts++
                continue
              }
              throw createErr // Rethrow other errors
            }
          }
          if (!created) {
            console.error(`Failed to create product "${name}" after multiple attempts due to itemId conflicts`)
            results.errors++
          }
        }
      } catch (err) {
        console.error('Error processing bulk item:', err)
        results.errors++
      }
    }

    return NextResponse.json({
      message: 'Bulk upload completed',
      ...results
    }, { status: 200 })

  } catch (error) {
    console.error('Failed to process bulk upload:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk upload' },
      { status: 500 }
    )
  }
}
