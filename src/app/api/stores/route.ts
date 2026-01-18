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
    
    return NextResponse.json(stores)
  } catch (error) {
    console.error('Failed to fetch stores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    )
  }
}
