import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: 'Products must be an array' }, { status: 400 })
    }

    const results = {
      created: 0,
      updated: 0,
      errors: 0
    }

    // Get the current highest item ID to start numbering new items
    const lastProduct = await db.product.findFirst({
      orderBy: { itemId: 'desc' }
    })
    let nextItemId = lastProduct ? lastProduct.itemId + 1 : 101

    for (const item of products) {
      try {
        const { name, cost, price, stock } = item

        if (!name) {
          results.errors++
          continue
        }

        const existingProduct = await db.product.findFirst({
          where: { name: { equals: name } }
        })

        if (existingProduct) {
          await db.product.update({
            where: { id: existingProduct.id },
            data: {
              cost: parseFloat(cost) || existingProduct.cost,
              price: parseFloat(price) || existingProduct.price,
              warehouseStock: {
                increment: parseInt(stock) || 0
              }
            }
          })
          results.updated++
        } else {
          await db.product.create({
            data: {
              itemId: nextItemId++,
              name,
              cost: parseFloat(cost) || 0,
              price: parseFloat(price) || 0,
              warehouseStock: parseInt(stock) || 0
            }
          })
          results.created++
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
