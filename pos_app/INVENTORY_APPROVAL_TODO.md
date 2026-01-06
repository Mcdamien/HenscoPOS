# Inventory Approval Workflow TODO

## Overview
Implement a centralized approval workflow where store inventory edits create pending changes that require warehouse approval before being applied.

## Database Changes
- [x] Add `PendingInventoryChange` model to schema.prisma
- [ ] Create migration for the new model

## API Routes
- [x] Create `POST /api/inventory/request-change` - Create pending inventory change request
- [x] Create `GET /api/inventory/pending-changes` - Get all pending changes for warehouse approval
- [x] Create `POST /api/inventory/approve-change` - Approve and apply pending change
- [x] Create `POST /api/inventory/reject-change` - Reject pending change
- [x] Create `POST /api/inventory/cancel-change` - Allow store to cancel their pending change

## UI Components - Warehouse Side
- [x] Create `PendingApprovalsModal.tsx` - Modal to view and manage pending changes
- [x] Update `WarehouseView.tsx` - Add "Pending Approvals" button and badge counter

## Next Steps (Not Yet Implemented)
- Create `StoreInventoryView.tsx` - View for store inventory with Edit button
- Create `EditStoreProductModal.tsx` - Modal to submit pending inventory changes

## Testing
- [ ] Run Prisma migration: `npx prisma migrate dev --name add_pending_inventory_changes`
- [ ] Test creating pending change from store
- [ ] Test viewing pending changes in warehouse
- [ ] Test approving a pending change
- [ ] Test rejecting a pending change
- [ ] Test canceling a pending change

## Files Created
- `prisma/schema.prisma` - Added PendingInventoryChange model
- `src/app/api/inventory/request-change/route.ts`
- `src/app/api/inventory/pending-changes/route.ts`
- `src/app/api/inventory/approve-change/route.ts`
- `src/app/api/inventory/reject-change/route.ts`
- `src/app/api/inventory/cancel-change/route.ts`
- `src/components/pos/PendingApprovalsModal.tsx`
- `src/components/pos/EditStoreProductModal.tsx`
- Updated `src/components/pos/WarehouseView.tsx`

## How to Run
1. Run migration: `cd pos_app && npx prisma migrate dev --name add_pending_inventory_changes`
2. Restart the dev server

