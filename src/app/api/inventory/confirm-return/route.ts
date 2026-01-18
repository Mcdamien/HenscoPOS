import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, storeName, storeId } = body

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    let finalStoreId = storeId
    if (!finalStoreId && storeName) {
      const store = await db.store.findUnique({
        where: { name: storeName }
      })
      if (store) {
        finalStoreId = store.id
      }
    }

    // Update all 'approved' return changes for this product (and store if provided) to 'completed'
    await db.pendingInventoryChange.updateMany({
      where: {
        productId,
        storeId: finalStoreId,
        changeType: { in: ['return', 'remove_product'] },
        status: 'approved'
      },
      data: {
        status: 'completed'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Return confirmed and alert cleared'
    })
  } catch (error) {
    console.error('Failed to confirm return:', error)
    return NextResponse.json(
      { error: 'Failed to confirm return' },
      { status: 500 }
    )
  }
}
