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
 * Measures real menu size after paint so placement stays correct inside tables.
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

    // Prefer below so the three-dots stay visible under the pointer
    let top = rect.bottom + gap
    if (top + menuHeight > window.innerHeight - pad) {
      const above = rect.top - menuHeight - gap
      top = above >= pad ? above : Math.max(pad, window.innerHeight - menuHeight - pad)
    }

    return { top, left }
  }

  useEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    // Initial estimate from trigger only
    setCoords(computePosition())
  }, [open, align])

  useLayoutEffect(() => {
    if (!open) return

    function remeasure() {
      const menu = menuRef.current
      if (!menu) return
      const w = menu.offsetWidth || 160
      const h = menu.offsetHeight || 120
      const next = computePosition(w, h)
      if (next) setCoords(next)
    }

    remeasure()
    // Second frame: fonts / icons may affect size after first paint
    const raf = requestAnimationFrame(remeasure)
    return () => cancelAnimationFrame(raf)
  }, [open, align, children])

  useEffect(() => {
    if (!open) return
    function onScroll(e: Event) {
      // Ignore scrolls inside the menu itself
      const menu = menuRef.current
      if (menu && e.target instanceof Node && menu.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', () => setOpen(false))
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', () => setOpen(false))
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
                'fixed z-[101] min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
                !coords && 'invisible'
              )}
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
              }}
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
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        destructive && 'text-destructive focus:text-destructive',
        className
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) onClick?.()
      }}
    >
      {children}
    </button>
  )
}
