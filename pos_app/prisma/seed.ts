import { PrismaClient, AccountType, AccountSubType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // ============ CREATE CHARTS OF ACCOUNTS ============
  console.log('Creating Charts of Account...');

  // Create Main Accounts
  const mainAccounts = [
    { code: '1', name: 'Assets', type: AccountType.ASSET, description: 'Resources the business owns' },
    { code: '2', name: 'Liabilities', type: AccountType.LIABILITY, description: 'What the business owes to others' },
    { code: '3', name: 'Equity', type: AccountType.EQUITY, description: "The owner's stake in the business" },
    { code: '4', name: 'Revenue', type: AccountType.REVENUE, description: 'Money earned from sales' },
    { code: '5', name: 'Expenses', type: AccountType.EXPENSE, description: 'Costs to run the business' },
  ];

  const createdMainAccounts: Record<string, { id: string; code: string; name: string; type: AccountType }> = {};

  for (const mainAccount of mainAccounts) {
    const created = await prisma.mainAccount.upsert({
      where: { code: mainAccount.code },
      update: mainAccount,
      create: mainAccount,
    });
    createdMainAccounts[mainAccount.code] = {
      id: created.id,
      code: created.code,
      name: created.name,
      type: created.type,
    };
    console.log(`  Created Main Account: ${mainAccount.name}`);
  }

  // Create Account Categories
  const categories = [
    // Assets
    { mainAccountCode: '1', name: 'Current Assets', description: 'Assets that can be converted to cash within one year' },
    { mainAccountCode: '1', name: 'Fixed Assets', description: 'Long-term tangible assets' },
    // Liabilities
    { mainAccountCode: '2', name: 'Current Liabilities', description: 'Debts due within one year' },
    { mainAccountCode: '2', name: 'Long-Term Liabilities', description: 'Debts due after one year' },
    // Expenses
    { mainAccountCode: '5', name: 'Operating Expenses', description: 'Day-to-day business costs' },
    { mainAccountCode: '5', name: 'Cost of Goods Sold', description: 'Direct costs of producing goods sold' },
  ];

  const createdCategories: Record<string, { id: string; name: string }> = {};

  for (const category of categories) {
    const mainAccountId = createdMainAccounts[category.mainAccountCode].id;

    // First check if it exists
    const existing = await prisma.accountCategory.findFirst({
      where: {
        mainAccountId: mainAccountId,
        name: category.name,
      },
    });

    if (existing) {
      createdCategories[`${category.mainAccountCode}_${category.name}`] = {
        id: existing.id,
        name: existing.name,
      };
      console.log(`  Category already exists: ${category.name}`);
      continue;
    }

    const created = await prisma.accountCategory.create({
      data: {
        name: category.name,
        description: category.description,
        mainAccountId: mainAccountId,
      },
    });
    createdCategories[`${category.mainAccountCode}_${category.name}`] = {
      id: created.id,
      name: created.name,
    };
    console.log(`  Created Category: ${category.name}`);
  }

  // Create Child Accounts (Individual Chart of Accounts)
  const accounts = [
    // ============ ASSETS ============
    // Current Assets
    { code: '1010', name: 'Cash', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 50000 },
    { code: '1020', name: 'Accounts Receivable', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 25000 },
    { code: '1030', name: 'Inventory', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 75000 },
    { code: '1040', name: 'Prepaid Expenses', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, mainAccountCode: '1', categoryName: 'Current Assets', balance: 5000 },
    // Fixed Assets
    { code: '1100', name: 'Equipment', type: AccountType.ASSET, subType: AccountSubType.FIXED_ASSET, mainAccountCode: '1', categoryName: 'Fixed Assets', balance: 120000 },
    { code: '1110', name: 'Vehicle', type: AccountType.ASSET, subType: AccountSubType.FIXED_ASSET, mainAccountCode: '1', categoryName: 'Fixed Assets', balance: 85000 },
    { code: '1120', name: 'Building', type: AccountType.ASSET, subType: AccountSubType.FIXED_ASSET, mainAccountCode: '1', categoryName: 'Fixed Assets', balance: 500000 },
    // ============ LIABILITIES ============
    // Current Liabilities
    { code: '2010', name: 'Accounts Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, mainAccountCode: '2', categoryName: 'Current Liabilities', balance: 15000 },
    { code: '2020', name: 'Credit Card Balances', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, mainAccountCode: '2', categoryName: 'Current Liabilities', balance: 5000 },
    { code: '2030', name: 'Short-Term Loans', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, mainAccountCode: '2', categoryName: 'Current Liabilities', balance: 20000 },
    // Long-Term Liabilities
    { code: '2100', name: 'Bank Loans', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, mainAccountCode: '2', categoryName: 'Long-Term Liabilities', balance: 150000 },
    { code: '2110', name: 'Mortgages', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, mainAccountCode: '2', categoryName: 'Long-Term Liabilities', balance: 350000 },
    // ============ EQUITY ============
    { code: '3010', name: "Owner's Capital", type: AccountType.EQUITY, subType: AccountSubType.OTHER, mainAccountCode: '3', categoryName: '', balance: 400000 },
    { code: '3020', name: 'Retained Earnings', type: AccountType.EQUITY, subType: AccountSubType.OTHER, mainAccountCode: '3', categoryName: '', balance: 150000 },
    { code: '3030', name: "Owner's Draws/Dividends", type: AccountType.EQUITY, subType: AccountSubType.OTHER, mainAccountCode: '3', categoryName: '', balance: 0 },
    // ============ REVENUE ============
    { code: '4010', name: 'Sales Revenue', type: AccountType.REVENUE, subType: AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
    { code: '4020', name: 'Service Revenue', type: AccountType.REVENUE, subType: AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
    { code: '4030', name: 'Interest Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
    { code: '4040', name: 'Rental Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER, mainAccountCode: '4', categoryName: '', balance: 0 },
    // ============ EXPENSES ============
    // Operating Expenses
    { code: '5010', name: 'Rent', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
    { code: '5020', name: 'Utilities', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
    { code: '5030', name: 'Salaries & Wages', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
    { code: '5040', name: 'Marketing', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
    { code: '5050', name: 'Insurance', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
    { code: '5060', name: 'Office Supplies', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, mainAccountCode: '5', categoryName: 'Operating Expenses', balance: 0 },
    // COGS
    { code: '5100', name: 'Cost of Goods Sold', type: AccountType.EXPENSE, subType: AccountSubType.COGS, mainAccountCode: '5', categoryName: 'Cost of Goods Sold', balance: 0 },
  ];

  for (const account of accounts) {
    const categoryKey = `${account.mainAccountCode}_${account.categoryName}`;
    const categoryId = account.categoryName ? createdCategories[categoryKey]?.id : null;
    const mainAccountId = createdMainAccounts[account.mainAccountCode].id;

    await prisma.account.upsert({
      where: { code: account.code },
      update: { balance: 0 },
      create: {
        code: account.code,
        name: account.name,
        type: account.type,
        subType: account.subType,
        mainAccountId: mainAccountId,
        categoryId: categoryId,
        balance: account.balance,
      },
    });
    console.log(`  Created Account: ${account.code} - ${account.name}`);
  }

  console.log('Charts of Account created successfully!');

  // ============ CREATE STORES ============
  console.log('\nCreating stores...');

  const stores = ['Klagon Shop', 'Teshie Shop', 'Online shop'];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { name: store },
      update: {},
      create: { name: store },
    });
    console.log(`  Created Store: ${store}`);
  }

  console.log('Stores created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

