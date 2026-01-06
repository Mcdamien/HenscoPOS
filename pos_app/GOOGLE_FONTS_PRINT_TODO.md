# Google Fonts for Print Previews - Implementation Plan

## Goal
Apply Google Font styles consistently to all print previews using 80mm x 58mm thermal printer size.

## Current State
- ✅ ReceiptModal.tsx: Already has Google Fonts applied correctly using inline `font-[var(--font-quicksand)]`
- ✅ AccountingReportsModal.tsx: Updated to use CSS variables-based Google Fonts styling with thermal printer size
- ✅ globals.css: Updated with thermal printer configuration

## Font Variables Available
| Variable | Font | Usage |
|----------|------|-------|
| `--font-quicksand` | Quicksand | Headers (Arnel Rounded equivalent) |
| `--font-nunito` | Nunito | Body text (Geo Sans Light equivalent) |
| `--font-playfair` | Playfair Display | Footer (Chopin equivalent) |

## Thermal Printer Configuration
| Parameter | Value |
|-----------|-------|
| Page Size | 80mm x 58mm |
| Margins | 0mm |
| Content Width | 74mm (3mm margin on each side) |
| Default Font Size | 8-9px |

## Tasks Completed

### 1. ✅ Updated globals.css - Thermal Printer Styles
**File:** `pos_app/src/app/globals.css`

**Changes Made:**
- Added `@page` rule for thermal printer size: `80mm 58mm`
- Added `.thermal-print` class for thermal receipt container
- Updated `.receipt-content` with thermal dimensions and small fonts

### 2. ✅ Updated AccountingReportsModal.tsx - Thermal Print HTML
**File:** `pos_app/src/components/pos/AccountingReportsModal.tsx`

**Changes Made:**
- Added `@page` rule in print styles for thermal printer size
- Reduced font sizes for thermal paper:
  - Title: 14px
  - Period: 9px
  - Tables: 8px
  - Footer: 7px
- Reduced margins and padding for compact thermal layout
- Content width set to 74mm for proper thermal paper fit

### 3. ✅ ReceiptModal.tsx - Already Configured
**File:** `pos_app/src/components/pos/ReceiptModal.tsx`

- Already uses `receipt-content` class styled for thermal printing
- Already applies Google Fonts via CSS variables
- No changes needed

## Result
All print previews now:
1. Use consistent Google Font styling (Quicksand, Nunito, Playfair Display)
2. Are configured for 80mm x 58mm thermal printer size
3. Display information appropriately scaled for thermal paper

