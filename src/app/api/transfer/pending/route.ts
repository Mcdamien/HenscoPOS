import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const store = searchParams.get('store')

    if (!store) {
      return NextResponse.json(
        { error: 'Store name is required' },
        { status: 400 }
      )
    }

    // Get pending transfers for this store
    const [pendingTransfers, pendingCount] = await Promise.all([
      db.stockTransfer.findMany({
        where: {
          toStore: store,
          status: 'pending'
        },
        include: {
          items: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      db.stockTransfer.count({
        where: {
          toStore: store,
          status: 'pending'
        }
      })
    ])

    return NextResponse.json({
      transfers: pendingTransfers,
      count: pendingCount
    })

  } catch (error) {
    console.error('Failed to fetch pending transfers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending transfers' },
      { status: 500 }
    )
  }
}

