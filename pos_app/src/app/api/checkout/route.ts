import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_SHOPS } from '@/lib/constants'

interface CartItem {
  id: string
  itemId: number
  name: string
  price: number
  qty: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store, items }: { store: string; items: CartItem[] } = body

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

    if (!ALLOWED_SHOPS.includes(store as any)) {
      return NextResponse.json(
        { error: 'Unauthorized store' },
        { status: 403 }
      )
    }

    // Get or create store
    let storeRecord = await db.store.findUnique({
      where: { name: store }
    })

    if (!storeRecord) {
      storeRecord = await db.store.create({
        data: { name: store }
      })
    }

    // Verify stock and calculate totals
    let subtotal = 0
    const itemsToCreate: {
      productId: string
      itemName: string
      itemPrice: number
      itemCost: number
      qty: number
    }[] = []

    const inventoryUpdates: {
      inventoryId: string
      qty: number
    }[] = []

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.id },
        include: {
          inventories: {
            where: { storeId: storeRecord.id }
          }
        }
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.name} not found` },
          { status: 404 }
        )
      }

      const storeStock = product.inventories[0]?.stock || 0

      if (storeStock < item.qty) {
        return NextResponse.json(
          { error: `Insufficient stock for ${item.name}. Only ${storeStock} available.` },
          { status: 400 }
        )
      }

      subtotal += product.price * item.qty
      
      itemsToCreate.push({
        productId: item.id,
        itemName: item.name,
        itemPrice: product.price,
        itemCost: product.cost,
        qty: item.qty,
      })

      if (product.inventories[0]?.id) {
        inventoryUpdates.push({
          inventoryId: product.inventories[0].id,
          qty: item.qty
        })
      }
    }

    // Calculate tax and total
    const tax = subtotal * 0.125
    const total = subtotal + tax

    // Use a transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // 1. Get the next transaction ID
      const lastTransaction = await tx.transaction.findFirst({
        orderBy: { transactionId: 'desc' }
      })
      const nextTransactionId = lastTransaction ? lastTransaction.transactionId + 1 : 10001

      // 2. Create transaction
      const transaction = await tx.transaction.create({
        data: {
          transactionId: nextTransactionId,
          storeId: storeRecord.id,
          subtotal,
          tax,
          total,
          items: {
            create: itemsToCreate
          }
        },
        include: {
          items: true
        }
      })

      // 3. Update inventory for each item
      for (const update of inventoryUpdates) {
        await tx.inventory.update({
          where: { id: update.inventoryId },
          data: {
            stock: {
              decrement: update.qty
            }
          }
        })
      }

      // 4. Accounting Entries
      // Generate entry number
      const lastEntry = await tx.journalEntry.findFirst({
        orderBy: { entryNumber: 'desc' }
      })
      const lastNum = lastEntry ? parseInt(lastEntry.entryNumber.replace('JE', '')) : 0
      const entryNumber = `JE${(lastNum + 1).toString().padStart(6, '0')}`

      // A. Sale: Debit Cash (1010), Credit Sales Revenue (4010)
      const cashAccount = await tx.account.findUnique({ where: { code: '1010' } })
      const revenueAccount = await tx.account.findUnique({ where: { code: '4010' } })
      
      // B. COGS: Debit COGS (5100), Credit Inventory (1030)
      const cogsAccount = await tx.account.findUnique({ where: { code: '5100' } })
      const inventoryAccount = await tx.account.findUnique({ where: { code: '1030' } })

      if (cashAccount && revenueAccount) {
        const totalCost = itemsToCreate.reduce((sum, item) => sum + (item.itemCost * item.qty), 0)

        await tx.journalEntry.create({
          data: {
            entryNumber,
            date: new Date(),
            description: `Sales from ${store} (TXN #${nextTransactionId})`,
            isPosted: true,
            lines: {
              create: [
                { accountId: cashAccount.id, description: `Cash from sale`, debit: total, credit: 0 },
                { accountId: revenueAccount.id, description: `Sales revenue`, debit: 0, credit: total },
              ]
            }
          }
        })

        // Update balances
        await tx.account.update({
          where: { id: cashAccount.id },
          data: { balance: { increment: total } }
        })
        await tx.account.update({
          where: { id: revenueAccount.id },
          data: { balance: { increment: total } }
        })

        if (cogsAccount && inventoryAccount && totalCost > 0) {
          const cogsEntryNumber = `JE${(lastNum + 2).toString().padStart(6, '0')}`
          await tx.journalEntry.create({
            data: {
              entryNumber: cogsEntryNumber,
              date: new Date(),
              description: `COGS for ${store} (TXN #${nextTransactionId})`,
              isPosted: true,
              lines: {
                create: [
                  { accountId: cogsAccount.id, description: `Cost of goods sold`, debit: totalCost, credit: 0 },
                  { accountId: inventoryAccount.id, description: `Inventory reduction`, debit: 0, credit: totalCost },
                ]
              }
            }
          })

          await tx.account.update({
            where: { id: cogsAccount.id },
            data: { balance: { increment: totalCost } }
          })
          await tx.account.update({
            where: { id: inventoryAccount.id },
            data: { balance: { decrement: totalCost } }
          })
        }
      }

      return transaction
    })

    // Return transaction data for receipt
    return NextResponse.json({
      id: result.transactionId,
      date: result.createdAt.toISOString(),
      store: store,
      subtotal: result.subtotal,
      tax: result.tax,
      total: result.total,
      items: result.items.map(item => ({
        id: item.id,
        itemName: item.itemName,
        itemPrice: item.itemPrice,
        qty: item.qty
      }))
    })
  } catch (error) {
    console.error('Checkout failed:', error)
    return NextResponse.json(
      { error: 'Checkout failed' },
      { status: 500 }
    )
  }
}
