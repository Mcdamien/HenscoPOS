# Low Stock Tile Enhancement - TODO

## Goal
Update the dashboard overview to show count of all low stock items AND out of stock items from the warehouse inventory list.

## Changes Required

### 1. Update API: `/api/dashboard/stats/route.ts`
- [x] Add `outOfStockCount` to the response
- [x] Update the counting logic to separate:
  - `outOfStockCount`: Count of items with warehouseStock === 0
  - `lowStockCount`: Count of items with warehouseStock > 0 && warehouseStock < 10
- [x] Return both counts in the JSON response

### 2. Update Dashboard UI: `/src/components/pos/DashboardView.tsx`
- [x] Update `DashboardStats` interface to include `outOfStockCount`
- [x] Update the stats state initialization to include `outOfStockCount: 0`
- [x] Update the "Low Stock" stat card to display:
  - Show both "Low Stock" and "Out of Stock" counts
  - Add appropriate icons and styling for each count
  - Update the trend text to reflect both counts

## Implementation Steps

### Step 1: Update the API route
```typescript
// Count low stock and out of stock items from warehouse inventory only
const outOfStockItems = allProducts.filter(p => p.warehouseStock === 0)
const lowStockItems = allProducts.filter(p => p.warehouseStock > 0 && p.warehouseStock < 10)

return NextResponse.json({
  // ... other stats
  lowStockCount: lowStockItems.length,
  outOfStockCount: outOfStockItems.length,
  shopSummary: shopSummary
})
```

### Step 2: Update the Dashboard UI
Update the StatCard for "Low Stock" to display both counts:
- Out of Stock: (icon) count (red/amber styling)
- Low Stock: (icon) count (amber styling)

## Testing
- [ ] Verify API returns both counts correctly
- [ ] Verify dashboard displays both counts
- [ ] Verify counts match the warehouse inventory list

