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

    // Count low stock and out of stock items from warehouse inventory only
    // Low stock: 1-19 items, Out of stock: 0 items
    const allProducts = await db.product.findMany({
      include: {
        inventories: true
      }
    })

    let lowStockCount = 0
    let outOfStockCount = 0
    
    allProducts.forEach(product => {
      // Check warehouse stock
      if (product.warehouseStock === 0) {
        outOfStockCount++
      } else if (product.warehouseStock < 20) {
        lowStockCount++
      }

      // Check shop inventories
      product.inventories.forEach(inventory => {
        if (inventory.stock === 0) {
          outOfStockCount++
        } else if (inventory.stock < 20) {
          lowStockCount++
        }
      })
    })

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
      lowStockCount: lowStockCount,
      outOfStockCount: outOfStockCount,
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

