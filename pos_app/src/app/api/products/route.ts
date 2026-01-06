import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET all products
export async function GET() {
  try {
    const products = await db.product.findMany({
      orderBy: { itemId: 'asc' }
    })
    
    return NextResponse.json(products)
  } catch (error) {
    console.error('Failed to fetch products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST create or update product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, cost, price, stock } = body

    // Check if product already exists by name
    const existingProduct = await db.product.findFirst({
      where: { name: { equals: name } }
    })

    if (existingProduct) {
      const updatedProduct = await db.product.update({
        where: { id: existingProduct.id },
        data: {
          cost: parseFloat(cost),
          price: parseFloat(price),
          warehouseStock: {
            increment: parseInt(stock)
          }
        }
      })
      return NextResponse.json(updatedProduct, { status: 200 })
    }

    // Get the next item ID
    const lastProduct = await db.product.findFirst({
      orderBy: { itemId: 'desc' }
    })
    const nextItemId = lastProduct ? lastProduct.itemId + 1 : 101

    // Create product
    const product = await db.product.create({
      data: {
        itemId: nextItemId,
        name,
        cost: parseFloat(cost),
        price: parseFloat(price),
        warehouseStock: parseInt(stock)
      }
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Failed to create product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
