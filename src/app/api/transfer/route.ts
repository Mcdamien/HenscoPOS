import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, targetStore } = body // items is an array of { productId, qty }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided for transfer' },
        { status: 400 }
      )
    }

    // Get or create target store
    let store = await db.store.findUnique({
      where: { name: targetStore }
    })

    if (!store) {
      store = await db.store.create({
        data: { name: targetStore }
      })
    }

    // Start a transaction - create pending transfer (no stock movement yet)
    const result = await db.$transaction(async (tx) => {
      // 1. Get next transferId
      const lastTransfer = await tx.stockTransfer.findFirst({
        orderBy: { transferId: 'desc' }
      })
      const nextTransferId = (lastTransfer?.transferId || 0) + 1

      // 2. Create the StockTransfer record with 'pending' status
      const stockTransfer = await tx.stockTransfer.create({
        data: {
          transferId: nextTransferId,
          fromStore: 'Warehouse',
          toStore: targetStore,
          status: 'pending'
        }
      })

      // 3. Create transfer items (no stock movement yet)
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        })

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`)
        }

        if (product.warehouseStock < item.qty) {
          throw new Error(`Insufficient stock for ${product.name}! Available: ${product.warehouseStock}`)
        }

        // Create StockTransferItem only (no stock movement)
        await tx.stockTransferItem.create({
          data: {
            stockTransferId: stockTransfer.id,
            productId: item.productId,
            itemName: product.name,
            qty: item.qty
          }
        })
      }

      return { transferId: nextTransferId }
    })

    return NextResponse.json({ 
      success: true, 
      transferId: result.transferId,
      message: `Transfer #${result.transferId} completed successfully` 
    })
  } catch (error: any) {
    console.error('Failed to transfer stock:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to transfer stock' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const transfers = await db.stockTransfer.findMany({
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(transfers)
  } catch (error) {
    console.error('Failed to fetch transfers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transfer history' },
      { status: 500 }
    )
  }
}
