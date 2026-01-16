import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  console.time('query')
  const count = await db.transaction.count()
  console.timeEnd('query')
  console.log('Transaction count:', count)
  await db.$disconnect()
}
main()
