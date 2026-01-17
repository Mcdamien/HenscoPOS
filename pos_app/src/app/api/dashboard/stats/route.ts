import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

export async function GET() {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Create separate date objects for different ranges to avoid side effects
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const storeFilter = {
      store: {
        name: { in: [...ALLOWED_SHOPS] }
      }
    }

    const [daily, weekly, monthly, allTime, shopSales] = await Promise.all([
      db.transaction.aggregate({
        where: { 
          createdAt: { gte: startOfDay },
          ...storeFilter
        },
        _sum: { total: true },
        _count: { id: true }
      }),
      db.transaction.aggregate({
        where: { 
          createdAt: { gte: startOfWeek },
          ...storeFilter
        },
        _sum: { total: true }
      }),
      db.transaction.aggregate({
        where: { 
          createdAt: { gte: startOfMonth },
          ...storeFilter
        },
        _sum: { total: true }
      }),
      db.transaction.aggregate({
        where: storeFilter,
        _sum: { total: true, subtotal: true },
        _count: { id: true }
      }),
      // Get shop-wise sales summary for current year
      db.transaction.groupBy({
        by: ['storeId'],
        where: { 
          createdAt: { gte: startOfYear },
          ...storeFilter
        },
        _sum: { total: true },
        _count: { id: true }
      })
    ])

    // Calculate profit (subtotal - itemCosts) using raw query for efficiency
    // We filter by allowed shops in the raw SQL
    const shopsPlaceholder = ALLOWED_SHOPS.map(s => `'${s.replace(/'/g, "''")}'`).join(',')
    const profitResult = await db.$queryRawUnsafe<[{ netProfit: number }][]>(`
      SELECT SUM((ti.itemPrice - ti.itemCost) * ti.qty) as netProfit 
      FROM TransactionItem ti
      JOIN "Transaction" t ON ti.transactionId = t.id
      JOIN Store s ON t.storeId = s.id
      WHERE s.name IN (${shopsPlaceholder})
    `)
    const totalProfit = (profitResult as any)[0]?.netProfit || 0

    // Count low stock and out of stock items
    // Filter inventory by allowed stores
    
    const [productCount, filteredStoreCount, warehouseOutCount, warehouseLowCount, shopInventoryStats] = await Promise.all([
      db.product.count(),
      db.store.count({ where: { name: { in: [...ALLOWED_SHOPS] } } }),
      db.product.count({ where: { warehouseStock: 0 } }),
      db.product.count({ where: { warehouseStock: { gt: 0, lt: 20 } } }),
      db.inventory.aggregate({
        _count: { id: true },
        where: { 
          stock: { gt: 0 },
          store: { name: { in: [...ALLOWED_SHOPS] } }
        }
      })
    ])

    // Get all shop inventory records that are actually low stock for allowed stores
    const shopLowStockCount = await db.inventory.count({
      where: { 
        stock: { gt: 0, lt: 20 },
        store: { name: { in: [...ALLOWED_SHOPS] } }
      }
    })

    // Total possible shop stock positions (every product in every allowed store)
    const totalShopPositions = productCount * filteredStoreCount
    
    // Items that have > 0 stock in allowed shops
    const shopInStockCount = shopInventoryStats._count.id || 0
    
    // Out of stock in allowed shops = Total positions - In stock positions
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

