import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const storeId = searchParams.get('storeId')

    // Build query filters
    const where: any = {
      status
    }

    // If storeId is provided, filter by store
    if (storeId) {
      where.storeId = storeId
    }

    const pendingChanges = await db.pendingInventoryChange.findMany({
      where,
      include: {
        product: true,
        store: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Format response
    const formattedChanges = pendingChanges.map(change => ({
      id: change.id,
      productId: change.productId,
      storeId: change.storeId,
      product: {
        id: change.product.id,
        itemId: change.product.itemId,
        name: change.product.name
      },
      store: {
        id: change.store.id,
        name: change.store.name
      },
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

    // Get count of pending changes
    const pendingCount = await db.pendingInventoryChange.count({
      where: { status: 'pending' }
    })

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

