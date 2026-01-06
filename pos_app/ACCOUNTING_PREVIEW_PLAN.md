# Accounting Report Preview Feature Implementation Plan

## Information Gathered

### Current Implementation Analysis:
- **File**: `AccountingReportsModal.tsx` (~850 lines)
- **Existing Features**:
  - Report type selection (P&L, Trial Balance, Balance Sheet)
  - Date range selection
  - API integration for report data
  - PDF download functionality
  - Print functionality
  - Basic summary preview (only totals shown)
  
- **Existing HTML Generation Functions** (unused for preview):
  - `generatePrintHTML()` - generates full report HTML for printing
  - `generateProfitLossHTML()` - generates detailed P&L HTML
  - `generateTrialBalanceHTML()` - generates detailed trial balance HTML
  - `generateBalanceSheetHTML()` - generates detailed balance sheet HTML

### What's Missing:
A comprehensive visual preview section that shows the complete report content (all line items) before the user decides to download or print.

---

## Plan

### Phase 1: Add Preview State Management
1. Add state variable `showPreview` (boolean) to track preview mode
2. Add state variable `isPreviewLoading` (boolean) for smooth preview transitions
3. Add ref for preview content to enable scrolling

### Phase 2: Create Preview Modal Component
1. Add a "Preview" button next to "Download PDF" button
2. Create a new Dialog/Modal for the preview that:
   - Shows the report header (title, date range)
   - Displays all account line items in tables
   - Shows summary totals
   - Has "Download PDF" and "Print" buttons inside the preview
   - Has a close button to return to main modal

### Phase 3: Reuse Existing HTML Generation
1. Use `generatePrintHTML()` function content to display in preview
2. Render the HTML safely in the preview modal
3. Apply print-friendly styles for the preview

### Phase 4: Update UI Layout
1. Main modal shows summary + "Generate", "Download PDF", "Print", "Preview" buttons
2. Preview modal shows full report content
3. Ensure responsive design for both modals

---

## Files to Modify

### 1. `pos_app/src/components/pos/AccountingReportsModal.tsx`

**State Additions**:
```typescript
const [showPreview, setShowPreview] = useState(false)
const [isPreviewLoading, setIsPreviewLoading] = useState(false)
```

**New Functions**:
- `handlePreview()` - prepares and shows preview
- `closePreview()` - closes preview mode

**UI Additions**:
1. Add "Preview" button in the action buttons area:
```tsx
<Button onClick={handlePreview} variant="outline">
  <Eye className="w-4 h-4 mr-2" />
  Preview
</Button>
```

2. Add Preview Modal after the main Dialog content:
```tsx
<Dialog open={showPreview} onOpenChange={setShowPreview}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    {/* Full report preview content */}
  </DialogContent>
</Dialog>
```

**Style Updates**:
- Import `Eye` icon from lucide-react
- Add preview-specific CSS classes

---

## Implementation Steps

### Step 1: Add Icon Import
Add `Eye` icon to lucide-react imports

### Step 2: Add Preview State
Add state variables for preview management

### Step 3: Add Preview Handler Function
Create function to open preview modal with smooth transition

### Step 4: Add Preview Button
Add "Preview" button in the action area (between Generate and Download)

### Step 5: Create Preview Modal
Add new Dialog component that shows full report content using existing HTML generation functions

### Step 6: Style Preview Modal
Apply print-friendly styles for optimal preview experience

### Step 7: Test Preview Flow
Verify preview displays correctly for all three report types

---

## Preview Modal Layout

### Header Section:
- Report Title (e.g., "Profit & Loss Statement")
- Date Range / Period
- Generated timestamp

### Content Section:
- Revenue/Assets Section with full table
- Expenses/Liabilities Section with full table
- Equity Section (for Balance Sheet)
- Summary totals section

### Footer Section:
- Action buttons (Download PDF, Print)
- Close button

---

## Success Criteria

1. Preview button is visible after report generation
2. Clicking Preview opens a modal with full report content
3. All line items are displayed in tables
4. Summary totals are shown
5. Download and Print buttons work from preview modal
6. Preview can be closed to return to main modal
7. All three report types (P&L, Trial Balance, Balance Sheet) work correctly

---

## Estimated Effort
- **Development Time**: ~2 hours
- **Complexity**: Medium
- **Risk**: Low (using existing HTML generation functions)

