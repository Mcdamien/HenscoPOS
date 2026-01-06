# Accounting Report Preview Feature Implementation

## Progress: ✅ Started

### Step 1: Add Eye Icon Import
- [ ] Add `Eye` icon to lucide-react imports

### Step 2: Add Preview State Management
- [ ] Add `showPreview` state variable
- [ ] Add `isPreviewLoading` state variable

### Step 3: Add Preview Handler Function
- [ ] Create `handlePreview()` function to open preview modal
- [ ] Add smooth loading transition

### Step 4: Add Preview Button to UI
- [ ] Add "Preview" button in action area (next to Download PDF)
- [ ] Only visible after report is generated

### Step 5: Create Preview Modal Component
- [ ] Add new Dialog component for preview
- [ ] Display full report header (title, period)
- [ ] Show all account line items in tables
- [ ] Include summary totals section

### Step 6: Style Preview Modal
- [ ] Apply print-friendly CSS styles
- [ ] Make it responsive
- [ ] Add proper spacing and formatting

### Step 7: Add Action Buttons in Preview
- [ ] Add "Download PDF" button
- [ ] Add "Print" button
- [ ] Add "Close" button

### Step 8: Test All Report Types
- [ ] Test Profit & Loss preview
- [ ] Test Trial Balance preview
- [ ] Test Balance Sheet preview

---

## Implementation Notes

### Preview Modal Features:
- Shows complete report content (not just summary)
- Uses existing HTML generation functions
- Full table view with all account line items
- Proper formatting and colors
- Action buttons for download/print/close

### Visual Design:
- Clean, professional accounting report layout
- Color-coded sections (revenue/green, expenses/red, etc.)
- Clear headers and totals
- Scrollable content area

---

## Status: 🟡 In Progress

