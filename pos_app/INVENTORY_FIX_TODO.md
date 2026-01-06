# Inventory Fix TODO

## Issue 1: Fix app crash when adding quantity
- [x] Update validation in `handleAddMore` to properly validate stock as positive integer
- [x] Add NaN and invalid value checks

## Issue 2: Remove close button from Add Inventory modal
- [ ] Add `hideCloseButton` prop to DialogContent

## Issue 3: Remove total amount display from Add Inventory modal
- [ ] Remove the total batch cost display section from the footer

## Changes Made

### AddInventoryModal.tsx

#### Fix 1: Improved validation for stock input
```typescript
// Before (line ~122)
if (!currentItem.stock || parseInt(currentItem.stock) <= 0) {
  toast.error('Valid quantity is required')
  setTimeout(() => stockInputRef.current?.focus(), 0)
  return
}

// After - Better validation
const stockNum = parseInt(currentItem.stock)
if (!currentItem.stock || isNaN(stockNum) || stockNum <= 0) {
  toast.error('Valid quantity (positive number) is required')
  setTimeout(() => stockInputRef.current?.focus(), 0)
  return
}
```

#### Fix 2: Remove close button
- Added `hideCloseButton` to DialogContent

#### Fix 3: Remove total amount display
- Removed the total cost display section from the footer

