import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pendingChangeId, reviewedBy } = body

    if (!pendingChangeId) {
      return NextResponse.json(
        { error: 'Pending change ID is required' },
        { status: 400 }
      )
    }

    // Get the pending change
    const pendingChange = await db.pendingInventoryChange.findUnique({
      where: { id: pendingChangeId },
      include: {
        product: true
      }
    })

    if (!pendingChange) {
      return NextResponse.json(
        { error: 'Pending change not found' },
        { status: 404 }
      )
    }

    if (pendingChange.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve change. Current status: ${pendingChange.status}` },
        { status: 400 }
      )
    }

    // Get or create the store inventory record
    let inventory = await db.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId: pendingChange.storeId,
          productId: pendingChange.productId
        }
      }
    })

    // Apply the change based on type
    if (pendingChange.changeType === 'add') {
      // For 'add' type: transfer from warehouse to store
      // Check warehouse stock again
      if (pendingChange.product.warehouseStock < pendingChange.qty) {
        return NextResponse.json(
          { error: `Insufficient warehouse stock. Only ${pendingChange.product.warehouseStock} units available.` },
          { status: 400 }
        )
      }

      // Decrement warehouse stock
      await db.product.update({
        where: { id: pendingChange.productId },
        data: {
          warehouseStock: {
            decrement: pendingChange.qty
          }
        }
      })

      // Increment store inventory
      if (inventory) {
        await db.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: {
              increment: pendingChange.qty
            }
          }
        })
      } else {
        await db.inventory.create({
          data: {
            storeId: pendingChange.storeId,
            productId: pendingChange.productId,
            stock: pendingChange.qty
          }
        })
      }
    } else if (pendingChange.changeType === 'remove') {
      // For 'remove' type: remove from store (no return to warehouse)
      if (inventory) {
        await db.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: {
              decrement: pendingChange.qty
            }
          }
        })
      }
    } else if (pendingChange.changeType === 'return') {
      // For 'return' type: remove from store and add back to warehouse
      if (inventory) {
        // Check if there's enough stock to return
        if (inventory.stock < pendingChange.qty) {
          return NextResponse.json(
            { error: `Insufficient store stock. Only ${inventory.stock} units available.` },
            { status: 400 }
          )
        }

        // Decrement store inventory
        await db.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: {
              decrement: pendingChange.qty
            }
          }
        })
      }

      // Increment warehouse stock
      await db.product.update({
        where: { id: pendingChange.productId },
        data: {
          warehouseStock: {
            increment: pendingChange.qty
          }
        }
      })
    } else if (pendingChange.changeType === 'adjust') {
      // For 'adjust' type: update inventory quantity if qty is provided
      if (pendingChange.qty !== 0 && inventory) {
        // Set stock to the specified qty (could be add or remove depending on diff)
        const currentStock = inventory.stock
        const diff = pendingChange.qty - currentStock
        
        if (diff > 0) {
          // Need to add from warehouse
          if (pendingChange.product.warehouseStock < diff) {
            return NextResponse.json(
              { error: `Insufficient warehouse stock. Need ${diff} more units.` },
              { status: 400 }
            )
          }
          
          await db.product.update({
            where: { id: pendingChange.productId },
            data: {
              warehouseStock: {
                decrement: diff
              }
            }
          })
        }

        await db.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: pendingChange.qty
          }
        })
      }

      // Update price/cost if provided
      if (pendingChange.newCost !== null || pendingChange.newPrice !== null) {
        await db.product.update({
          where: { id: pendingChange.productId },
          data: {
            cost: pendingChange.newCost !== null ? pendingChange.newCost : undefined,
            price: pendingChange.newPrice !== null ? pendingChange.newPrice : undefined
          }
        })
      }
    }

    // Update pending change status
    await db.pendingInventoryChange.update({
      where: { id: pendingChangeId },
      data: {
        status: 'approved',
        reviewedBy,
        reviewedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Inventory change approved and applied successfully'
    })
  } catch (error) {
    console.error('Failed to approve inventory change:', error)
    return NextResponse.json(
      { error: 'Failed to approve inventory change' },
      { status: 500 }
    )
  }
}

