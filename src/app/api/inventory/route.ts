import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

//import prisma from '@/lib/prisma'
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('storeId')
    const storeName = searchParams.get('store') || searchParams.get('storeName')

    if (!storeId && !storeName) {
      return NextResponse.json(
        { error: 'storeId or storeName parameter is required' },
        { status: 400 }
      )
    }

    let storeRecord
    if (storeId) {
      storeRecord = await db.store.findUnique({
        where: { id: storeId }
      })
    } 
    
    if (!storeRecord && storeName) {
      if (!ALLOWED_SHOPS.includes(storeName as any)) {
        return NextResponse.json(
          { error: 'Unauthorized store' },
          { status: 403 }
        )
      }

      // Get or create store by name (legacy support)
      storeRecord = await db.store.findUnique({
        where: { name: storeName }
      })

      if (!storeRecord) {
        storeRecord = await db.store.create({
          data: { name: storeName }
        })
      }
    }

    if (!storeRecord) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    // Get all products with their inventory for this store
    const products = await db.product.findMany({
      select: {
        id: true,
        itemId: true,
        name: true,
        cost: true,
        price: true,
        warehouseStock: true,
        inventories: {
          where: { storeId: storeRecord.id },
          select: { stock: true }
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

// DELETE inventory record (remove product from store)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const storeId = searchParams.get('storeId')
    const storeName = searchParams.get('storeName') || searchParams.get('store')

    if (!productId || (!storeId && !storeName)) {
      return NextResponse.json(
        { error: 'Product ID and (Store ID or Store Name) are required' },
        { status: 400 }
      )
    }

    let store
    if (storeId) {
      store = await db.store.findUnique({
        where: { id: storeId }
      })
    }

    if (!store && storeName) {
      store = await db.store.findUnique({
        where: { name: storeName }
      })
    }

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    await db.inventory.delete({
      where: {
        storeId_productId: {
          storeId: store.id,
          productId: productId
        }
      }
    })

    return NextResponse.json({ message: 'Product removed from store successfully' })
  } catch (error) {
    console.error('Failed to remove product from store:', error)
    return NextResponse.json(
      { error: 'Failed to remove product from store' },
      { status: 500 }
    )
  }
}
