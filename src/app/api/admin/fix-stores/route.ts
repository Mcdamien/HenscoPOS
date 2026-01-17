import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Find the 'Cape Coast Shop' store if it exists
    const oldStore = await db.store.findUnique({
      where: { name: 'Cape Coast Shop' }
    })

    if (!oldStore) {
      return NextResponse.json({
        status: 'ok',
        message: 'Cape Coast Shop not found in database - no migration needed'
      })
    }

    // Check if 'Online shop' already exists
    const newStore = await db.store.findUnique({
      where: { name: 'Online shop' }
    })

    if (newStore) {
      // Merge: migrate all transactions and inventory from old to new
      await db.transaction.updateMany({
        where: { storeId: oldStore.id },
        data: { storeId: newStore.id }
      })

      await db.inventory.updateMany({
        where: { storeId: oldStore.id },
        data: { storeId: newStore.id }
      })

      // Delete old store
      await db.store.delete({
        where: { id: oldStore.id }
      })

      return NextResponse.json({
        status: 'migrated',
        message: 'Migrated Cape Coast Shop data to Online shop and deleted old store',
        transactionsMoved: await db.transaction.count({
          where: { storeId: newStore.id }
        })
      })
    } else {
      // Just rename the store
      const updated = await db.store.update({
        where: { id: oldStore.id },
        data: { name: 'Online shop' }
      })

      return NextResponse.json({
        status: 'renamed',
        message: 'Renamed Cape Coast Shop to Online shop',
        store: updated.name
      })
    }
  } catch (error) {
    console.error('Fix stores failed:', error)
    return NextResponse.json(
      { error: 'Fix stores failed', details: String(error) },
      { status: 500 }
    )
  }
}
