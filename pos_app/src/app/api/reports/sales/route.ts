import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

export async function GET() {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Fix for startOfWeek: don't mutate 'now'
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get only allowed stores
    const stores = await db.store.findMany({
      where: {
        name: { in: [...ALLOWED_SHOPS] }
      }
    })

    const salesData = await Promise.all(stores.map(async (store) => {
      const [daily, weekly, monthly, allTime] = await Promise.all([
        db.transaction.aggregate({
          where: { 
            storeId: store.id,
            createdAt: { gte: startOfDay } 
          },
          _sum: { total: true },
          _count: { id: true }
        }),
        db.transaction.aggregate({
          where: { 
            storeId: store.id,
            createdAt: { gte: startOfWeek } 
          },
          _sum: { total: true }
        }),
        db.transaction.aggregate({
          where: { 
            storeId: store.id,
            createdAt: { gte: startOfMonth } 
          },
          _sum: { total: true }
        }),
        db.transaction.aggregate({
          where: { storeId: store.id },
          _sum: { total: true },
          _count: { id: true }
        })
      ])

      return {
        storeId: store.id,
        storeName: store.name,
        daily: daily._sum.total || 0,
        dailyCount: daily._count.id || 0,
        weekly: weekly._sum.total || 0,
        monthly: monthly._sum.total || 0,
        allTime: allTime._sum.total || 0,
        allTimeCount: allTime._count.id || 0
      }
    }))

    // Calculate totals
    const totals = {
      daily: salesData.reduce((sum, s) => sum + s.daily, 0),
      dailyCount: salesData.reduce((sum, s) => sum + s.dailyCount, 0),
      weekly: salesData.reduce((sum, s) => sum + s.weekly, 0),
      monthly: salesData.reduce((sum, s) => sum + s.monthly, 0),
      allTime: salesData.reduce((sum, s) => sum + s.allTime, 0),
      allTimeCount: salesData.reduce((sum, s) => sum + s.allTimeCount, 0)
    }

    return NextResponse.json({
      overall: totals,
      byStore: salesData
    })
  } catch (error) {
    console.error('Failed to fetch sales reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales reports' },
      { status: 500 }
    )
  }
}
