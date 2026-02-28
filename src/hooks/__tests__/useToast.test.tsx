import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../useToast'

// Mock do sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

describe('useToast Hook', () => {
  it('should have showToast function', () => {
    const { result } = renderHook(() => useToast())

    expect(result.current.showToast).toBeDefined()
    expect(typeof result.current.showToast).toBe('function')
  })

  it('should call toast.success for success type', () => {
    const { result } = renderHook(() => useToast())
    const { toast } = require('sonner')

    act(() => {
      result.current.showToast('Success message', 'success')
    })

    expect(toast.success).toHaveBeenCalledWith('Success message')
  })

  it('should call toast.error for error type', () => {
    const { result } = renderHook(() => useToast())
    const { toast } = require('sonner')

    act(() => {
      result.current.showToast('Error message', 'error')
    })

    expect(toast.error).toHaveBeenCalledWith('Error message')
  })

  it('should call toast.warning for warning type', () => {
    const { result } = renderHook(() => useToast())
    const { toast } = require('sonner')

    act(() => {
      result.current.showToast('Warning message', 'warning')
    })

    expect(toast.warning).toHaveBeenCalledWith('Warning message')
  })

  it('should call toast.info for info type', () => {
    const { result } = renderHook(() => useToast())
    const { toast } = require('sonner')

    act(() => {
      result.current.showToast('Info message', 'info')
    })

    expect(toast.info).toHaveBeenCalledWith('Info message')
  })

  it('should default to info type when no type provided', () => {
    const { result } = renderHook(() => useToast())
    const { toast } = require('sonner')

    act(() => {
      result.current.showToast('Default message')
    })

    expect(toast.info).toHaveBeenCalledWith('Default message')
  })
})