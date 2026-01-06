# Transaction Numeric Input Fix - TODO

## Task
Make debit and credit fields in add transaction view accept numbers only.

## Files to Modify
- [x] `src/components/pos/TransactionModal.tsx`

## Changes Required
1. [x] Add `handleNumberChange` helper function to validate numeric input
2. [x] Update debit field `onChange` handler to use the validation function
3. [x] Update credit field `onChange` handler to use the validation function

## Implementation Details
- Filter to allow only digits (0-9) and at most one decimal point
- Limit to 2 decimal places for currency precision
- Handle edge cases: empty input, multiple decimals, leading zeros

## Status
- [x] Analyzed codebase
- [x] Created implementation plan
- [x] Updated TransactionModal.tsx
- [ ] Tested functionality

