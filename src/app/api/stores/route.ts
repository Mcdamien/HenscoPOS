import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

export async function GET() {
  try {
    const stores = await db.store.findMany({
      where: {
        name: { in: [...ALLOWED_SHOPS] }
      },
      orderBy: { name: 'asc' }
    })
    
    // Return array of names to match existing usage patterns if any, 
    // or objects if that's what's expected.
    // Given WarehouseView used string[], let's return names or check if objects are better.
    // TransferModal uses stores: string[]
    return NextResponse.json(stores.map(s => s.name))
  } catch (error) {
    console.error('Failed to fetch stores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    )
  }
}
