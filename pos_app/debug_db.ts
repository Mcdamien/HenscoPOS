import { PrismaClient } from './generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Database Check ---')
  
  const transactions = await prisma.transaction.findMany({
    include: {
      store: true
    }
  })
  console.log('Total Transactions:', transactions.length)
  
  const totalSum = await prisma.transaction.aggregate({
    _sum: { total: true }
  })
  console.log('Total Revenue (Sum):', totalSum._sum.total)

  const stores = await prisma.store.findMany()
  console.log('Stores in DB:', stores.map(s => s.name))
  
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  console.log('Start of Year Filter:', startOfYear.toISOString())
  
  const transactionsThisYear = await prisma.transaction.count({
    where: {
      createdAt: { gte: startOfYear }
    }
  })
  console.log('Transactions since start of year:', transactionsThisYear)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
