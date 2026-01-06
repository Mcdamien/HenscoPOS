import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, storeId, changeType, qty, newCost, newPrice, reason, requestedBy } = body

    // Validate required fields
    if (!productId || !storeId || !changeType) {
      return NextResponse.json(
        { error: 'Product ID, Store ID, and Change Type are required' },
        { status: 400 }
      )
    }

    // Validate change type
    if (!['add', 'remove', 'adjust'].includes(changeType)) {
      return NextResponse.json(
        { error: 'Invalid change type. Must be add, remove, or adjust' },
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

    // Check if store exists
    const store = await db.store.findUnique({
      where: { id: storeId }
    })

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    // For 'add' changes, validate warehouse stock
    if (changeType === 'add' && qty > 0) {
      if (product.warehouseStock < qty) {
        return NextResponse.json(
          { error: `Insufficient warehouse stock. Only ${product.warehouseStock} units available.` },
          { status: 400 }
        )
      }
    }

    // For 'remove' changes, validate store stock
    if (changeType === 'remove' && qty > 0) {
      const inventory = await db.inventory.findUnique({
        where: {
          storeId_productId: {
            storeId,
            productId
          }
        }
      })

      if (!inventory || inventory.stock < qty) {
        const currentStock = inventory?.stock || 0
        return NextResponse.json(
          { error: `Insufficient store stock. Only ${currentStock} units available.` },
          { status: 400 }
        )
      }
    }

    // Check for existing pending change for the same product and store
    const existingPending = await db.pendingInventoryChange.findFirst({
      where: {
        productId,
        storeId,
        status: 'pending'
      }
    })

    if (existingPending) {
      return NextResponse.json(
        { error: 'A pending change already exists for this product. Please wait for it to be reviewed.' },
        { status: 400 }
      )
    }

    // Create pending inventory change
    const pendingChange = await db.pendingInventoryChange.create({
      data: {
        productId,
        storeId,
        changeType,
        qty: parseInt(qty) || 0,
        newCost: newCost ? parseFloat(newCost) : null,
        newPrice: newPrice ? parseFloat(newPrice) : null,
        reason,
        requestedBy
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Inventory change request submitted for approval',
      pendingChange
    })
  } catch (error) {
    console.error('Failed to request inventory change:', error)
    return NextResponse.json(
      { error: 'Failed to submit inventory change request' },
      { status: 500 }
    )
  }
}

