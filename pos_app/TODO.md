# Transaction View Enhancement - TODO

## Goal
Enhance the TransactionModal with:
1. Type of Account dropdown (child accounts for the main account)
2. Description field
3. Other Account field for unique accounts
4. Smart Debit/Credit fields that gray out based on account type
5. Checkbox override option for gray-out logic

## Implementation Steps

### Step 1: Update TransactionModal.tsx ✅ COMPLETED
- [x] Add state for selected child account and override checkbox
- [x] Create child accounts data structure for each main account type
- [x] Add "Type of Account" dropdown component
- [x] Add Description text field
- [x] Add "Other Account" optional field
- [x] Implement smart Debit/Credit gray-out logic
- [x] Add checkbox to override gray-out
- [x] Update form validation and submission

### Step 2: Update AccountingView.tsx ✅ COMPLETED
- [x] Update AccountEntry interface to use account/otherAccount instead of category
- [x] Update mock data with new structure
- [x] Update AccountTable component to show account instead of category
- [x] Add helper function to get account display name
- [x] Update overview table to show account column

## Account Type Rules ✅
- **Assets & Expenses**: Debit enabled (money coming in), Credit grayed out
- **Liabilities, Equity & Revenue**: Credit enabled (money going out), Debit grayed out

## Child Accounts Structure ✅
```
Assets:
  - Cash (1010)
  - Accounts Receivable (1020)
  - Inventory (1030)
  - Prepaid Expenses (1040)
  - Equipment (1100)
  - Vehicle (1110)
  - Building (1120)

Liabilities:
  - Accounts Payable (2010)
  - Credit Card Balances (2020)
  - Short-Term Loans (2030)
  - Bank Loans (2100)
  - Mortgages (2110)

Equity:
  - Owner's Capital (3010)
  - Retained Earnings (3020)
  - Owner's Draws/Dividends (3030)

Revenue:
  - Sales Revenue (4010)
  - Service Revenue (4020)
  - Interest Income (4030)
  - Rental Income (4040)

Expenses:
  - Rent (5010)
  - Utilities (5020)
  - Salaries & Wages (5030)
  - Marketing (5040)
  - Insurance (5050)
  - Office Supplies (5060)
  - Cost of Goods Sold (5100)
```

## Status: ✅ COMPLETED
