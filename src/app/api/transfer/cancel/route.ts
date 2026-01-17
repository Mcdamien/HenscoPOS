import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transferId, reason, cancelledBy } = body

    console.log('=== CANCEL TRANSFER DEBUG ===')
    console.log('Received transferId:', transferId, 'Type:', typeof transferId)
    console.log('Received reason:', reason)
    console.log('Received cancelledBy:', cancelledBy)

    if (!transferId) {
      console.error('Transfer ID is missing from request')
      return NextResponse.json(
        { error: 'Transfer ID is required' },
        { status: 400 }
      )
    }

    // Parse transferId to ensure it's an integer
    const parsedTransferId = parseInt(transferId)
    if (isNaN(parsedTransferId)) {
      console.error('Invalid transferId format:', transferId)
      return NextResponse.json(
        { error: `Invalid Transfer ID format: ${transferId}` },
        { status: 400 }
      )
    }

    console.log('Parsed transferId:', parsedTransferId)

    // Find the transfer
    const transfer = await db.stockTransfer.findUnique({
      where: { transferId: parsedTransferId }
    })

    console.log('Found transfer:', transfer ? {
      id: transfer.id,
      transferId: transfer.transferId,
      status: transfer.status
    } : 'NOT FOUND')

    if (!transfer) {
      return NextResponse.json(
        { error: `Transfer not found with ID: ${parsedTransferId}` },
        { status: 404 }
      )
    }

    if (transfer.status !== 'pending') {
      console.error(`Cannot cancel transfer. Current status: ${transfer.status}`)
      return NextResponse.json(
        { error: `Cannot cancel transfer. Current status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Update transfer status to cancelled
    const cancelledTransfer = await db.stockTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledReason: reason || 'No reason provided'
      }
    })

    console.log('Transfer cancelled successfully:', cancelledTransfer.transferId)

    return NextResponse.json({
      success: true,
      message: `Transfer #${parsedTransferId} has been cancelled`,
      transfer: {
        id: cancelledTransfer.id,
        transferId: cancelledTransfer.transferId,
        status: cancelledTransfer.status
      }
    })

  } catch (error: any) {
    console.error('=== CANCEL TRANSFER ERROR ===')
    console.error('Failed to cancel transfer:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel transfer' },
      { status: 500 }
    )
  }
}

