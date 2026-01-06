# Task: Make Inventory Status Tile Clickable

## Plan Summary
Make the inventory status tile in DashboardView clickable to show details of items needing restock.

## Implementation Steps

### Step 1: Create Low Stock API Endpoint
- [x] Create `/api/products/low-stock/route.ts` to return items needing restock
- [x] Endpoint should return out of stock (0) and low stock (< 20) items

### Step 2: Create RestockItemsModal Component  
- [x] Create `RestockItemsModal.tsx` component
- [x] Display table of items needing restock
- [x] Show item details: name, ID, current stock, cost, price
- [x] Add restock action functionality

### Step 3: Modify DashboardView
- [x] Add state for `showRestockModal` and `restockItems`
- [x] Make Inventory Status Card clickable (cursor-pointer, hover effects)
- [x] Add onClick handler to fetch and show low stock items
- [x] Import and render RestockItemsModal component

### Step 4: Testing
- [x] Verify the inventory status tile is clickable
- [x] Verify the modal displays items needing restock
- [x] Verify restock functionality works

