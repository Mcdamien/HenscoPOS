import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const [daily, weekly, monthly, allTime, shopSales] = await Promise.all([
      db.transaction.aggregate({
        where: { createdAt: { gte: startOfDay } },
        _sum: { total: true },
        _count: { id: true }
      }),
      db.transaction.aggregate({
        where: { createdAt: { gte: startOfWeek } },
        _sum: { total: true }
      }),
      db.transaction.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { total: true }
      }),
      db.transaction.aggregate({
        _sum: { total: true, subtotal: true },
        _count: { id: true }
      }),
      // Get shop-wise sales summary for current year
      db.transaction.groupBy({
        by: ['storeId'],
        where: { createdAt: { gte: startOfYear } },
        _sum: { total: true },
        _count: { id: true }
      })
    ])

    // Calculate profit (subtotal - itemCosts)
    const transactions = await db.transaction.findMany({
      include: { items: true }
    })

    let totalProfit = 0
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        totalProfit += (item.itemPrice - item.itemCost) * item.qty
      })
    })

    // Count low stock and out of stock items
    // Low stock: 1-19 items, Out of stock: 0 items
    
    const [productCount, storeCount, warehouseOutCount, warehouseLowCount, shopInventoryStats] = await Promise.all([
      db.product.count(),
      db.store.count(),
      db.product.count({ where: { warehouseStock: 0 } }),
      db.product.count({ where: { warehouseStock: { gt: 0, lt: 20 } } }),
      db.inventory.aggregate({
        _count: { id: true },
        where: { stock: { gt: 0 } }
      })
    ])

    // Get all shop inventory records that are actually low stock
    const shopLowStockCount = await db.inventory.count({
      where: { stock: { gt: 0, lt: 20 } }
    })

    // Total possible shop stock positions (every product in every store)
    const totalShopPositions = productCount * storeCount
    
    // Items that have > 0 stock in shops
    const shopInStockCount = shopInventoryStats._count.id || 0
    
    // Out of stock in shops = Total positions - In stock positions
    const shopOutOfStockCount = totalShopPositions - shopInStockCount

    const totalOutOfStock = warehouseOutCount + shopOutOfStockCount
    const totalLowStock = warehouseLowCount + shopLowStockCount

    // Format shop sales data
    const shopSummary = shopSales.map(shop => ({
      storeId: shop.storeId,
      totalSales: shop._sum.total || 0,
      transactionCount: shop._count.id || 0
    })).sort((a, b) => b.totalSales - a.totalSales)

    return NextResponse.json({
      dailySales: daily._sum.total || 0,
      dailyCount: daily._count.id || 0,
      weeklySales: weekly._sum.total || 0,
      monthlySales: monthly._sum.total || 0,
      totalSales: allTime._sum.total || 0,
      transactions: allTime._count.id || 0,
      netProfit: totalProfit,
      lowStockCount: totalLowStock,
      outOfStockCount: totalOutOfStock,
      shopSummary: shopSummary
    })
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

