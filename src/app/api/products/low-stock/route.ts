import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const store = searchParams.get('store')

    let lowStockItems = []

    if (!store || store === 'Warehouse') {
      // Get all products with their warehouse stock
      const products = await db.product.findMany({
        select: {
          id: true,
          itemId: true,
          name: true,
          cost: true,
          price: true,
          warehouseStock: true,
          restockQty: true
        }
      })

      // Filter items needing restock: out of stock (0) or low stock (< 20)
      lowStockItems = products
        .filter(product => product.warehouseStock < 20)
        .map(product => ({
          id: product.id,
          itemId: product.itemId,
          name: product.name,
          cost: product.cost,
          price: product.price,
          currentStock: product.warehouseStock,
          restockQty: product.restockQty || 10,
          shop: 'Warehouse'
        }))
    } else {
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
        }
      })

      lowStockItems = products
        .map(product => ({
          id: product.id,
          itemId: product.itemId,
          name: product.name,
          cost: product.cost,
          price: product.price,
          currentStock: product.inventories[0]?.stock || 0,
          restockQty: product.restockQty || 10,
          shop: store
        }))
        .filter(product => product.currentStock < 20)
    }

    // Sort by stock level: out of stock first, then by name
    lowStockItems.sort((a, b) => {
      if (a.currentStock === 0 && b.currentStock > 0) return -1
      if (a.currentStock > 0 && b.currentStock === 0) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json(lowStockItems)
  } catch (error) {
    console.error('Failed to fetch low stock items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch low stock items' },
      { status: 500 }
    )
  }
}

