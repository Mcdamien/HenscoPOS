'use client'

import { useCallback, useRef, useState, useEffect } from 'react'

interface FieldRef {
  element: HTMLElement | null
  onEnter?: () => void
}

interface UseKeyboardNavigationProps {
  fieldCount: number
  onEnterSubmit?: () => void
  onTabNext?: () => void
  onTabPrev?: () => void
}

export function useKeyboardNavigation({
  fieldCount,
  onEnterSubmit,
  onTabNext,
  onTabPrev
}: UseKeyboardNavigationProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const fieldRefs = useRef<(HTMLElement | null)[]>(new Array(fieldCount).fill(null))
  
  // Focus on a specific field by index
  const focusField = useCallback((index: number) => {
    if (index >= 0 && index < fieldCount) {
      setFocusedIndex(index)
      // Use setTimeout to ensure the element is ready to receive focus
      setTimeout(() => {
        const element = fieldRefs.current[index]
        if (element) {
          // For input elements, select all text
          if (element instanceof HTMLInputElement) {
            element.select()
          }
          element.focus()
        }
      }, 0)
    }
  }, [fieldCount])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      
      if (e.shiftKey) {
        // Shift + Tab: Move to previous field
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : fieldCount - 1
        setFocusedIndex(prevIndex)
        focusField(prevIndex)
        onTabPrev?.()
      } else {
        // Tab: Move to next field
        const nextIndex = currentIndex < fieldCount - 1 ? currentIndex + 1 : 0
        setFocusedIndex(nextIndex)
        focusField(nextIndex)
        onTabNext?.()
      }
    } else if (e.key === 'Enter') {
      // Enter key triggers form submission or custom action
      e.preventDefault()
      if (onEnterSubmit) {
        onEnterSubmit()
      }
    }
  }, [fieldCount, focusField, onEnterSubmit, onTabNext, onTabPrev])

  // Register a field at a specific index
  const registerField = useCallback((index: number) => {
    return (element: HTMLElement | null) => {
      fieldRefs.current[index] = element
      // If this is the focused index, focus the element
      if (element && index === focusedIndex) {
        setTimeout(() => {
          element.focus()
          if (element instanceof HTMLInputElement) {
            element.select()
          }
        }, 0)
      }
    }
  }, [focusedIndex])

  // Focus on the first field when modal opens
  const focusFirstField = useCallback(() => {
    setFocusedIndex(0)
    focusField(0)
  }, [focusField])

  // Focus on the last field
  const focusLastField = useCallback(() => {
    const lastIndex = fieldCount - 1
    setFocusedIndex(lastIndex)
    focusField(lastIndex)
  }, [fieldCount, focusField])

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    registerField,
    focusField,
    focusFirstField,
    focusLastField,
    fieldRefs
  }
}

// Simplified hook for forms with static fields
export function useTabNavigation(fieldCount: number) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const fieldRefs = useRef<(HTMLElement | null)[]>(new Array(fieldCount).fill(null))

  const focusField = useCallback((index: number) => {
    if (index >= 0 && index < fieldCount) {
      setFocusedIndex(index)
      setTimeout(() => {
        const element = fieldRefs.current[index]
        if (element) {
          if (element instanceof HTMLInputElement) {
            element.select()
          }
          element.focus()
        }
      }, 0)
    }
  }, [fieldCount])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      
      if (e.shiftKey) {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : fieldCount - 1
        setFocusedIndex(prevIndex)
        focusField(prevIndex)
      } else {
        const nextIndex = currentIndex < fieldCount - 1 ? currentIndex + 1 : 0
        setFocusedIndex(nextIndex)
        focusField(nextIndex)
      }
    }
  }, [fieldCount, focusField])

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    registerField: (index: number) => (el: HTMLElement | null) => {
      fieldRefs.current[index] = el
      if (el && index === focusedIndex) {
        setTimeout(() => {
          el.focus()
          if (el instanceof HTMLInputElement) {
            el.select()
          }
        }, 0)
      }
    },
    focusField,
    focusFirstField: () => focusField(0)
  }
}

// Hook for managing dynamic field lists (like cart items in POS)
export function useDynamicTabNavigation<T extends HTMLElement>(
  getItemCount: () => number,
  getFieldCount: () => number
) {
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const fieldRefs = useRef<Map<number, Map<number, T | null>>>(new Map())

  const registerField = useCallback((itemIndex: number, fieldIndex: number) => {
    return (element: T | null) => {
      if (!fieldRefs.current.has(itemIndex)) {
        fieldRefs.current.set(itemIndex, new Map())
      }
      fieldRefs.current.get(itemIndex)!.set(fieldIndex, element)
    }
  }, [])

  const focusField = useCallback((itemIndex: number, fieldIndex: number) => {
    setActiveItemIndex(itemIndex)
    setTimeout(() => {
      const itemMap = fieldRefs.current.get(itemIndex)
      const element = itemMap?.get(fieldIndex)
      if (element) {
        if (element instanceof HTMLInputElement) {
          element.select()
        }
        element.focus()
      }
    }, 0)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentItemIndex: number, currentFieldIndex: number) => {
    const itemCount = getItemCount()
    const fieldCount = getFieldCount()

    if (e.key === 'Tab') {
      e.preventDefault()
      
      let nextItemIndex = currentItemIndex
      let nextFieldIndex = currentFieldIndex

      if (e.shiftKey) {
        // Shift + Tab: Previous
        if (currentFieldIndex > 0) {
          nextFieldIndex = currentFieldIndex - 1
        } else if (currentItemIndex > 0) {
          nextItemIndex = currentItemIndex - 1
          nextFieldIndex = fieldCount - 1
        } else {
          nextItemIndex = itemCount - 1
          nextFieldIndex = fieldCount - 1
        }
      } else {
        // Tab: Next
        if (currentFieldIndex < fieldCount - 1) {
          nextFieldIndex = currentFieldIndex + 1
        } else if (currentItemIndex < itemCount - 1) {
          nextItemIndex = currentItemIndex + 1
          nextFieldIndex = 0
        } else {
          nextItemIndex = 0
          nextFieldIndex = 0
        }
      }

      focusField(nextItemIndex, nextFieldIndex)
    }
  }, [getItemCount, getFieldCount, focusField])

  return {
    activeItemIndex,
    setActiveItemIndex,
    handleKeyDown,
    registerField,
    focusField
  }
}

