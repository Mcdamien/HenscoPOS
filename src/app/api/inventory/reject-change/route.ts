import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pendingChangeId, reviewedBy, reason } = body

    if (!pendingChangeId) {
      return NextResponse.json(
        { error: 'Pending change ID is required' },
        { status: 400 }
      )
    }

    // Get the pending change
    const pendingChange = await db.pendingInventoryChange.findUnique({
      where: { id: pendingChangeId }
    })

    if (!pendingChange) {
      return NextResponse.json(
        { error: 'Pending change not found' },
        { status: 404 }
      )
    }

    if (pendingChange.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot reject change. Current status: ${pendingChange.status}` },
        { status: 400 }
      )
    }

    // Update pending change status to rejected
    await db.pendingInventoryChange.update({
      where: { id: pendingChangeId },
      data: {
        status: 'rejected',
        reviewedBy: reviewedBy || 'Warehouse Manager',
        reviewedAt: new Date(),
        reason: reason || 'Rejected by warehouse manager'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Inventory change rejected'
    })
  } catch (error) {
    console.error('Failed to reject inventory change:', error)
    return NextResponse.json(
      { error: 'Failed to reject inventory change' },
      { status: 500 }
    )
  }
}

