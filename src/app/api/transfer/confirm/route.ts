import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transferId, confirmedBy } = body

    console.log('=== CONFIRM TRANSFER DEBUG ===')
    console.log('Received transferId:', transferId, 'Type:', typeof transferId)
    console.log('Received confirmedBy:', confirmedBy)

    // Validate transferId is provided
    if (!transferId) {
      console.error('Transfer ID is missing from request')
      return NextResponse.json(
        { error: 'Transfer ID is required' },
        { status: 400 }
      )
    }

    // Parse transferId to ensure it's an integer
    const parsedTransferId = parseInt(transferId)
    if (isNaN(parsedTransferId)) {
      console.error('Invalid transferId format:', transferId)
      return NextResponse.json(
        { error: `Invalid Transfer ID format: ${transferId}` },
        { status: 400 }
      )
    }

    console.log('Parsed transferId:', parsedTransferId)

    // Find the transfer
    const transfer = await db.stockTransfer.findUnique({
      where: { transferId: parsedTransferId },
      include: {
        items: true
      }
    })

    console.log('Found transfer:', transfer ? {
      id: transfer.id,
      transferId: transfer.transferId,
      status: transfer.status,
      itemsCount: transfer.items.length
    } : 'NOT FOUND')

    if (!transfer) {
      return NextResponse.json(
        { error: `Transfer not found with ID: ${parsedTransferId}` },
        { status: 404 }
      )
    }

    // Check if transfer is still in pending status
    if (transfer.status !== 'pending') {
      console.error(`Cannot confirm transfer. Current status: ${transfer.status}`)
      return NextResponse.json(
        { error: `Cannot confirm transfer. Current status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Get or create the target store
    let store = await db.store.findUnique({
      where: { name: transfer.toStore }
    })

    if (!store) {
      console.log('Store not found, creating:', transfer.toStore)
      store = await db.store.create({
        data: { name: transfer.toStore }
      })
    }

    console.log('Processing stock transfer for store:', store.name)
    console.log('Items to transfer:', transfer.items.length)

    // Process the stock transfer in a transaction with a longer timeout
    const result = await db.$transaction(async (tx) => {
      // 1. Fetch all products involved at once
      const productIds = transfer.items.map(item => item.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } }
      })
      const productMap = new Map(products.map(p => [p.id, p]))

      // 2. Fetch all existing inventory records at once
      const existingInventories = await tx.inventory.findMany({
        where: {
          storeId: store!.id,
          productId: { in: productIds }
        }
      })
      const inventoryMap = new Map(existingInventories.map(inv => [inv.productId, inv]))

      // 3. Process each item
      for (const item of transfer.items) {
        const product = productMap.get(item.productId)

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`)
        }

        // Check warehouse stock
        if (product.warehouseStock < item.qty) {
          throw new Error(`Insufficient warehouse stock for ${product.name}! Available: ${product.warehouseStock}, Requested: ${item.qty}`)
        }

        // Decrement warehouse stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            warehouseStock: {
              decrement: item.qty
            }
          }
        })

        // Update or create store inventory
        const existingInventory = inventoryMap.get(item.productId)

        if (existingInventory) {
          await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              stock: {
                increment: item.qty
              }
            }
          })
        } else {
          await tx.inventory.create({
            data: {
              storeId: store!.id,
              productId: item.productId,
              stock: item.qty
            }
          })
        }
      }

      // 4. Update transfer status
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: confirmedBy || 'Store User'
        }
      })

      return updatedTransfer
    }, {
      timeout: 25000 // Increase timeout to 25 seconds for large batch confirmation
    })

    return NextResponse.json({
      success: true,
      message: `Transfer #${parsedTransferId} confirmed and stock updated`,
      transfer: {
        id: result.id,
        transferId: result.transferId,
        status: result.status
      }
    })

  } catch (error: any) {
    console.error('=== CONFIRM TRANSFER ERROR ===')
    console.error('Failed to confirm transfer:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to confirm transfer' },
      { status: 500 }
    )
  }
}

