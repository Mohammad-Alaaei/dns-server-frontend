import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
}

/**
 * Portaled dropdown positioned from the trigger's viewport rect.
 * After mount, remeasures real menu size so placement stays correct
 * inside scrollable tables / cards.
 */
export function DropdownMenu({ trigger, children, align = 'end' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const menuId = useId()

  function computePosition(menuWidth = 160, menuHeight = 120) {
    const el = triggerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const gap = 4
    const pad = 8

    let left = align === 'end' ? rect.right - menuWidth : rect.left
    left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad))

    // Prefer below the trigger so the button stays visible
    let top = rect.bottom + gap
    if (top + menuHeight > window.innerHeight - pad) {
      // Flip above if not enough room below
      const above = rect.top - menuHeight - gap
      top = above >= pad ? above : Math.max(pad, window.innerHeight - menuHeight - pad)
    }

    return { top, left }
  }

  // Initial position when opening
  useEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    setCoords(computePosition())
  }, [open, align])

  // Refine with real menu dimensions after paint
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return
    const menu = menuRef.current
    const w = menu.offsetWidth || 160
    const h = menu.offsetHeight || 120
    const next = computePosition(w, h)
    if (next) setCoords(next)
  }, [open, align, children])

  useEffect(() => {
    if (!open) return
    function onScroll() {
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleTriggerClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen((v) => !v)
  }

  function handleOverlayPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex cursor-pointer"
        onClick={handleTriggerClick}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {trigger}
      </div>
      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              aria-hidden
              onPointerDown={handleOverlayPointerDown}
            />
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className={cn(
                'fixed z-[101] min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md'
              )}
              style={{
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                visibility: coords ? 'visible' : 'hidden',
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div onClick={() => setOpen(false)}>{children}</div>
            </div>
          </>,
          document.body
        )}
    </>
  )
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled,
  destructive,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm outline-none transition-colors',
        disabled
          ? 'pointer-events-none cursor-not-allowed opacity-50'
          : 'hover:bg-accent hover:text-accent-foreground',
        destructive && 'text-destructive focus:text-destructive',
        className
      )}
    >
      {children}
    </button>
  )
}
