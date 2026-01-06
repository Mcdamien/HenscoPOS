# Transaction Modal Freeze Fix - TODO

## Problem
The add transaction view freezes when typing numbers in debit/credit fields because:
1. Every keystroke triggers `handleNumberChange` string sanitization
2. `useEffect` recalculates total on every character input
3. Multiple re-renders occur on rapid keystrokes

## Fix Plan
- [ ] Add `useCallback` to memoize `handleNumberChange` function
- [ ] Replace `useEffect` with `useMemo` for total calculation
- [ ] Add debounce mechanism to prevent excessive updates

## Changes to `TransactionModal.tsx`
1. Memoize `handleNumberChange` with `useCallback`
2. Replace `useEffect` dependency with `useMemo` for total
3. Add debounced input handling for better performance

## Status
- [x] Analyzed codebase and identified root cause
- [x] Created implementation plan
- [ ] Implementing fix
- [ ] Testing functionality

