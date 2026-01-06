import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, storeId: storeName, qty, returnedBy } = body

    // Validate required fields
    if (!productId || !storeName || !qty || qty <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
        { status: 400 }
      )
    }

    // Lookup store by name to get the actual store ID
    let storeRecord = await db.store.findUnique({
      where: { name: storeName }
    })

    // If store doesn't exist, create it
    if (!storeRecord) {
      storeRecord = await db.store.create({
        data: { name: storeName }
      })
    }

    // Find the store inventory record for this product and store using the actual store ID
    const inventory = await db.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId: storeRecord.id,
          productId
        }
      }
    })

    if (!inventory) {
      return NextResponse.json(
        { error: 'Store inventory record not found' },
        { status: 404 }
      )
    }

    // Check if there's enough stock to return
    if (inventory.stock < qty) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${inventory.stock}, Requested: ${qty}` },
        { status: 400 }
      )
    }

    // Check if product exists
    const product = await db.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check for existing pending change for the same product and store
    const existingPending = await db.pendingInventoryChange.findFirst({
      where: {
        productId,
        storeId: storeRecord.id,
        status: 'pending'
      }
    })

    if (existingPending) {
      return NextResponse.json(
        { error: 'A pending return already exists for this product. Please wait for it to be reviewed.' },
        { status: 400 }
      )
    }

    // Create a pending inventory change for the return
    // This will wait for warehouse approval before actually processing
    const pendingChange = await db.pendingInventoryChange.create({
      data: {
        productId,
        storeId: storeRecord.id,
        changeType: 'return',
        qty: parseInt(qty) || 0,
        reason: `Return from ${storeName}`,
        requestedBy: returnedBy || 'Store User'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Return request submitted for warehouse approval',
      pendingChange
    })

  } catch (error) {
    console.error('Error processing return request:', error)
    return NextResponse.json(
      { error: 'Failed to submit return request' },
      { status: 500 }
    )
  }
}

