import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, cost, price, qty } = body

    // Update product with new stock and prices
    const product = await db.product.update({
      where: { id: productId },
      data: {
        warehouseStock: {
          increment: parseInt(qty)
        },
        cost: parseFloat(cost),
        price: parseFloat(price)
      }
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Failed to restock:', error)
    return NextResponse.json(
      { error: 'Failed to restock product' },
      { status: 500 }
    )
  }
}
