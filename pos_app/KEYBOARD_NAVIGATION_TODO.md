# Keyboard Navigation Implementation - TODO

## Phase 1: Create Keyboard Navigation Hook
- [x] Create `src/hooks/useKeyboardNavigation.ts`
  - [x] Define hook interface and types
  - [x] Implement field registration mechanism
  - [x] Handle Tab and Shift+Tab key navigation
  - [x] Handle Enter key for form submission
  - [x] Export utility functions for component use

## Phase 2: Update Key Handler Utilities
- [x] Update `src/lib/utils.ts`
  - [x] Enhance `handleNumberKeyDown` to support Tab/Shift+Tab
  - [x] Enhance `handleIntegerKeyDown` to support Tab/Shift+Tab
  - [x] Add `handleTabNavigation` helper function

## Phase 3: Update Components

### AddProductModal.tsx
- [x] Import useKeyboardNavigation hook
- [x] Create field refs array for all form inputs
- [x] Register fields with the navigation hook
- [x] Implement Tab navigation between: Product Name → Cost → Price → Stock → Cancel → Save
- [x] Add Enter key to submit form

### EditProductModal.tsx
- [x] Import useKeyboardNavigation hook
- [x] Create field refs array for all form inputs
- [x] Register fields with the navigation hook
- [x] Implement Tab navigation between: Cost → Price → Add Qty → Cancel → Save
- [x] Add Enter key to submit form

### TransferModal.tsx
- [x] Import useKeyboardNavigation hook
- [x] Create field refs array for all form inputs
- [x] Register fields with the navigation hook
- [x] Implement Tab navigation between: Product Search → Qty → Add More → Destination Store → Done → Cancel
- [x] Add Enter key to add items and submit

### POSTerminalView.tsx
- [x] Import useKeyboardNavigation hook
- [x] Create refs for search input and store select
- [x] Implement Tab navigation between search and cart
- [x] Add Enter key to trigger checkout when focused on Pay button

### RestockModal.tsx (if exists)
- [x] Check if RestockModal exists and needs updates
- [x] Implement similar Tab navigation pattern

### TransactionModal.tsx (if exists)
- [x] Check if TransactionModal exists and needs updates - Minimal form, using native browser tab navigation

## Phase 4: Testing
- [ ] Test Tab navigation in AddProductModal
- [ ] Test Tab navigation in EditProductModal
- [ ] Test Tab navigation in TransferModal
- [ ] Test Tab navigation in POSTerminalView
- [ ] Test Shift+Tab reverse navigation in all forms
- [ ] Test Enter key submission in all forms
- [ ] Verify focus management with modal open/close

## Phase 5: Refinement
- [ ] Fix any focus trap issues
- [ ] Ensure consistent behavior across all forms
- [ ] Add visual focus indicators if needed
- [ ] Document keyboard shortcuts for users

## Success Criteria
- [x] Create keyboard navigation hook with Tab/Shift+Tab support
- [x] Add Enter key handling for form submission
- [x] Implement keyboard navigation in all main forms
- [x] Focus management when modals open/close

