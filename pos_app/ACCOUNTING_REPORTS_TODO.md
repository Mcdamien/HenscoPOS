# Accounting Reports Implementation Plan

## Task: Implement PDF Report Generation for Accounting Module

### Reports to Generate:
1. **Transaction Reports** (3 PDFs):
   - Daily transactions
   - Weekly transactions
   - Monthly transactions

2. **Standard Accounting Reports** (3 PDFs):
   - Profit & Loss Account
   - Trial Balance
   - Balance Sheet

---

## Implementation Steps

### Step 1: Install PDF Generation Libraries
- [ ] Install `jspdf` and `jspdf-autotable` for client-side PDF generation

### Step 2: Create API Endpoints
- [ ] Create `/api/reports/transactions` - Get transactions by period
- [ ] Create `/api/reports/profit-loss` - Get P&L data
- [ ] Create `/api/reports/trial-balance` - Get trial balance data
- [ ] Create `/api/reports/balance-sheet` - Get balance sheet data

### Step 3: Create Accounting Reports Modal Component
- [ ] Create `AccountingReportsModal.tsx`
- [ ] Add report type selection (Day/Week/Month/P&L/Trial/Balance)
- [ ] Implement PDF generation logic for each report type

### Step 4: Update AccountingView.tsx
- [ ] Connect "Generate Report" button to open AccountingReportsModal
- [ ] Add state management for report modal

---

## Report Specifications

### Transaction Report (Daily/Weekly/Monthly):
- Header with company name, report type, date range
- Table with: Date, Description, Account, Type, Amount
- Summary totals

### Profit & Loss Account:
- Revenue section (all income accounts)
- Expenses section (all expense accounts)
- Net profit calculation
- Date range filters

### Trial Balance:
- List of all accounts with balances
- Debit/Credit columns
- Total verification (Debits = Credits)

### Balance Sheet:
- Assets section (Current + Fixed)
- Liabilities section (Current + Long-term)
- Equity section
- Balance verification (Assets = Liabilities + Equity)

---

## Files to Create/Modify:

### New Files:
1. `src/app/api/reports/transactions/route.ts`
2. `src/app/api/reports/profit-loss/route.ts`
3. `src/app/api/reports/trial-balance/route.ts`
4. `src/app/api/reports/balance-sheet/route.ts`
5. `src/components/pos/AccountingReportsModal.tsx`

### Modified Files:
1. `src/components/pos/AccountingView.tsx` - Connect report button
2. `package.json` - Add jspdf dependencies

