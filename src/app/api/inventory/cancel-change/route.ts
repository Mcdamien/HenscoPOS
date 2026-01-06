import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pendingChangeId, requestedBy } = body

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
        { error: `Cannot cancel change. Current status: ${pendingChange.status}` },
        { status: 400 }
      )
    }

    // Only allow cancellation by the same user who requested it (or any admin)
    // For now, we'll allow any cancellation
    await db.pendingInventoryChange.update({
      where: { id: pendingChangeId },
      data: {
        status: 'cancelled',
        reviewedBy: requestedBy || 'Requester',
        reviewedAt: new Date(),
        reason: 'Cancelled by requester'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Inventory change request cancelled'
    })
  } catch (error) {
    console.error('Failed to cancel inventory change:', error)
    return NextResponse.json(
      { error: 'Failed to cancel inventory change request' },
      { status: 500 }
    )
  }
}

