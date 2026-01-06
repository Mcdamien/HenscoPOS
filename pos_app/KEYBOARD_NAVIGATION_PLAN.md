ho# Keyboard Tab Navigation Implementation Plan

## Objective
Implement keyboard tab navigation so that:
- Tab key moves focus to the next field
- Shift+Tab moves focus to the previous field

## Current Analysis

### Existing Key Handlers in `/lib/utils.ts`
The current implementation already includes Tab in allowed keys:
```typescript
const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', ...]
```

However, there are issues:
1. Tab navigation might not work consistently across different form components
2. No custom tab behavior implementation exists
3. Focus management across modal forms is not optimized

## Plan

### Phase 1: Create Keyboard Navigation Hook
**File:** `src/hooks/useKeyboardNavigation.ts`

Create a custom React hook that:
- Tracks all focusable elements in a form/modal
- Provides functions to move focus forward (Tab) and backward (Shift+Tab)
- Handles Enter key to submit forms
- Works with refs for dynamic elements

### Phase 2: Update Key Handler Utilities
**File:** `src/lib/utils.ts`

Enhance existing key handlers:
- Add proper Tab and Shift+Tab handling
- Ensure consistent behavior across all input types
- Add Enter key handling for form submission

### Phase 3: Update Components

#### 1. AddProductModal.tsx
- Add ref tracking for all form fields
- Implement Tab navigation between fields
- Add Enter key to submit form

#### 2. EditProductModal.tsx
- Add ref tracking for all form fields
- Implement Tab navigation between fields
- Add Enter key to submit form

#### 3. TransferModal.tsx
- Add ref tracking for all form fields
- Implement Tab navigation between fields
- Add Enter key to add items and submit transfer

#### 4. POSTerminalView.tsx
- Add ref tracking for search input and quantity fields
- Implement Tab navigation between product cards and cart items

#### 5. RestockModal.tsx
- Add ref navigation for restock form fields

### Phase 4: Testing and Refinement
- Test Tab navigation in all modals
- Test Shift+Tab reverse navigation
- Test Enter key submission
- Verify focus management in different scenarios

## Implementation Details

### useKeyboardNavigation Hook
```typescript
interface UseKeyboardNavigationProps {
  fieldsRef: React.MutableRefObject<(HTMLElement | null)[]>
  onEnter?: () => void
  onTabNext?: () => void
  onTabPrev?: () => void
}

export function useKeyboardNavigation({ fieldsRef, onEnter, onTabNext, onTabPrev }: UseKeyboardNavigationProps)
```

### Enhanced Key Handlers
```typescript
export function handleTabNavigation(
  e: React.KeyboardEvent,
  fieldsRef: React.MutableRefObject<(HTMLElement | null)[]>,
  currentIndex: number,
  direction: 'next' | 'prev'
)
```

## Files to Modify

1. `src/lib/utils.ts` - Add enhanced key handlers
2. `src/hooks/useKeyboardNavigation.ts` - NEW FILE
3. `src/components/pos/AddProductModal.tsx`
4. `src/components/pos/EditProductModal.tsx`
5. `src/components/pos/TransferModal.tsx`
6. `src/components/pos/POSTerminalView.tsx`
7. `src/components/pos/RestockModal.tsx`

## Success Criteria
- Tab key moves focus to next field in all forms
- Shift+Tab moves focus to previous field
- Enter key submits forms appropriately
- No focus trapping issues
- Consistent behavior across all modals and forms

