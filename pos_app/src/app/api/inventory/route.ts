import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

//import prisma from '@/lib/prisma'
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const store = searchParams.get('store')

    if (!store) {
      return NextResponse.json(
        { error: 'Store parameter is required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_SHOPS.includes(store as any)) {
      return NextResponse.json(
        { error: 'Unauthorized store' },
        { status: 403 }
      )
    }

    // Get or create store
    let storeRecord = await db.store.findUnique({
      where: { name: store }
    })

    if (!storeRecord) {
      storeRecord = await db.store.create({
        data: { name: store }
      })
    }

    // Get all products with their inventory for this store
    const products = await db.product.findMany({
      include: {
        inventories: {
          where: { storeId: storeRecord.id }
        }
      },
      orderBy: { itemId: 'asc' }
    })

    // Format response with store stock
    const productsWithStock = products.map(product => ({
      id: product.id,
      itemId: product.itemId,
      name: product.name,
      cost: product.cost,
      price: product.price,
      warehouseStock: product.warehouseStock,
      storeStock: product.inventories[0]?.stock || 0
    }))

    return NextResponse.json(productsWithStock)
  } catch (error) {
    console.error('Failed to fetch inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}
