import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const storeId = searchParams.get('storeId')

    // Build query filters
    const where: any = {
      status,
      store: {
        name: { in: [...ALLOWED_SHOPS] }
      }
    }

    // If storeId is provided, filter by store
    if (storeId) {
      where.storeId = storeId
    }

    const [pendingChanges, pendingCount] = await Promise.all([
      db.pendingInventoryChange.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              itemId: true,
              name: true
            }
          },
          store: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      db.pendingInventoryChange.count({
        where: { status: 'pending' }
      })
    ])

    // Format response
    const formattedChanges = pendingChanges.map(change => ({
      id: change.id,
      productId: change.productId,
      storeId: change.storeId,
      product: change.product,
      store: change.store,
      changeType: change.changeType,
      qty: change.qty,
      newCost: change.newCost,
      newPrice: change.newPrice,
      reason: change.reason,
      status: change.status,
      requestedBy: change.requestedBy,
      reviewedBy: change.reviewedBy,
      reviewedAt: change.reviewedAt,
      createdAt: change.createdAt
    }))

    return NextResponse.json({
      changes: formattedChanges,
      count: pendingCount
    })
  } catch (error) {
    console.error('Failed to fetch pending changes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending changes' },
      { status: 500 }
    )
  }
}

