import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const stores = await db.store.findMany()
    const transactions = await db.transaction.count()
    const products = await db.product.count()
    
    return NextResponse.json({
      status: 'ok',
      stores: stores.length,
      storeNames: stores.map(s => s.name),
      transactions,
      products
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: String(error)
    }, { status: 500 })
  }
}
