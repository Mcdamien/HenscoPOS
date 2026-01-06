# Handle Submit Fix TODO

## Problem
"Can't access lexical declaration 'handleSubmit' before initialization" error occurs because `handleSubmit` is used as a parameter in `useKeyboardNavigation` hook before it's declared.

## Files to Fix
1. [x] TransferModal.tsx - Move handleSubmit before useKeyboardNavigation
2. [x] AddProductModal.tsx - Move handleSubmit before useKeyboardNavigation
3. [ ] AddInventoryModal.tsx - Move handleSubmit before useKeyboardNavigation
4. [ ] EditProductModal.tsx - Move handleSubmit before useKeyboardNavigation

## Fix Strategy
Move the `handleSubmit` function declaration BEFORE the `useKeyboardNavigation` hook call in each file.

