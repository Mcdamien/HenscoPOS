// app/api/debug/health-check/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// This ensures we don't create too many instances in a serverless environment
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') global.prisma = prisma;

export async function GET() {
  try {
    // 1. Log the DATABASE_URL to see if it's even available
    console.log('Health Check: DATABASE_URL is', process.env.DATABASE_URL ? 'present' : 'MISSING!');

    // 2. Try to connect to the database
    await prisma.$connect();
    console.log('Health Check: Database connection successful.');

    // 3. Try a simple query. Replace 'Product' with one of your actual Prisma models!
    const count = await prisma.products.count(); // <--- CHANGE 'Product' TO YOUR MODEL
    console.log(`Health Check: Found ${count} items in the Product table.`);

    return NextResponse.json({ 
      message: 'Health check successful!',
      dbUrlPresent: !!process.env.DATABASE_URL,
      itemCount: count
    });

  } catch (error) {
    console.error('Health Check FAILED:', error);
    return NextResponse.json(
      { error: 'Database connection failed', details: error },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}