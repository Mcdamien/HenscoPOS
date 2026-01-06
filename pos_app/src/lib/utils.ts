import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date as DD/MM/YYYY
 * @param date - Date string or Date object
 * @returns Formatted date string in DD/MM/YYYY format
 */
export function formatDateDDMMYYYY(date: string | Date): string {
  const d = new Date(date)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Prevents non-numeric input in number fields
 * Allows: 0-9, Backspace, Delete, Tab, Escape, Enter, Arrow keys
 * Also allows: . (for decimals)
 */
export function handleNumberKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '.', 'End', 'Home']
  if (allowedKeys.includes(e.key) || (e.key >= '0' && e.key <= '9') || (e.ctrlKey || e.metaKey)) {
    return
  }
  e.preventDefault()
}

/**
 * Prevents non-integer input in number fields
 * Allows: 0-9, Backspace, Delete, Tab, Escape, Enter, Arrow keys
 */
export function handleIntegerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'End', 'Home']
  if (allowedKeys.includes(e.key) || (e.key >= '0' && e.key <= '9') || (e.ctrlKey || e.metaKey)) {
    return
  }
  e.preventDefault()
}

/**
 * Enhanced key handler that allows Tab navigation between fields
 * Use this for text inputs where Tab should move to next field
 */
export function handleTabKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'End', 'Home']
  if (allowedKeys.includes(e.key) || (e.key >= '0' && e.key <= '9') || (e.key >= 'a' && e.key <= 'z') || (e.key >= 'A' && e.key <= 'Z') || (e.ctrlKey || e.metaKey)) {
    return
  }
  e.preventDefault()
}

/**
 * Enhanced key handler for text inputs with decimal support
 */
export function handleTextKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'End', 'Home', ' ']
  if (allowedKeys.includes(e.key) || (e.key >= '0' && e.key <= '9') || (e.key >= 'a' && e.key <= 'z') || (e.key >= 'A' && e.key <= 'Z') || (e.ctrlKey || e.metaKey)) {
    return
  }
  e.preventDefault()
}

/**
 * Navigate to next/previous field programmatically
 */
export function navigateToField(
  currentIndex: number,
  direction: 'next' | 'prev',
  fieldCount: number,
  callback: (index: number) => void
) {
  let nextIndex: number
  if (direction === 'next') {
    nextIndex = currentIndex < fieldCount - 1 ? currentIndex + 1 : 0
  } else {
    nextIndex = currentIndex > 0 ? currentIndex - 1 : fieldCount - 1
  }
  callback(nextIndex)
}

