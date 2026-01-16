import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

export async function GET() {
  try {
    const shops = await db.store.findMany({
      where: {
        name: { in: [...ALLOWED_SHOPS] }
      },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(shops)
  } catch (error) {
    console.error('Failed to fetch shops:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shops' },
      { status: 500 }
    )
  }
}
