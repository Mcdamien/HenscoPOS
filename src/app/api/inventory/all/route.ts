import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const inventories = await db.inventory.findMany({
      include: {
        product: true,
        store: true
      }
    })
    
    // Format to match what SyncProvider expects
    const formatted = inventories.map(inv => ({
      id: inv.id,
      storeId: inv.storeId,
      productId: inv.productId,
      stock: inv.stock,
      updatedAt: inv.updatedAt
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Failed to fetch all inventories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch all inventories' },
      { status: 500 }
    )
  }
}
