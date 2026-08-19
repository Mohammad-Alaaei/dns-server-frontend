import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
}

const DropdownCloseContext = createContext<() => void>(() => {})

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

  function close() {
    setOpen(false)
  }

  function computePosition(menuWidth = 160, menuHeight = 120) {
    const el = triggerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const gap = 4
    const pad = 8

    let left = align === 'end' ? rect.right - menuWidth : rect.left
    left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad))

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
    const raf = requestAnimationFrame(remeasure)
    return () => cancelAnimationFrame(raf)
  }, [open, align, children])

  useEffect(() => {
    if (!open) return
    function onScroll(e: Event) {
      const menu = menuRef.current
      if (menu && e.target instanceof Node && menu.contains(e.target)) return
      // also ignore scroll inside any portaled submenu
      const t = e.target
      if (t instanceof Element && t.closest('[data-dropdown-submenu]')) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
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
              data-dropdown-root
              className={cn(
                'fixed z-[101] min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
                !coords && 'invisible'
              )}
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DropdownCloseContext.Provider value={close}>{children}</DropdownCloseContext.Provider>
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
  const close = useContext(DropdownCloseContext)
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
        if (disabled) return
        onClick?.()
        close()
      }}
    >
      {children}
    </button>
  )
}

/**
 * Parent row that opens a side submenu (e.g. "Resolve by" → resolvers).
 */
export function DropdownMenuSub({
  label,
  icon,
  children,
  disabled,
}: {
  label: ReactNode
  icon?: ReactNode
  children: ReactNode
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rowRef = useRef<HTMLButtonElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const closeRoot = useContext(DropdownCloseContext)

  useLayoutEffect(() => {
    if (!open || !rowRef.current) return
    function place() {
      const row = rowRef.current
      const sub = subRef.current
      if (!row) return
      const rect = row.getBoundingClientRect()
      const pad = 8
      const gap = 2
      const sw = sub?.offsetWidth || 160
      const sh = sub?.offsetHeight || 80

      let left = rect.right + gap
      if (left + sw > window.innerWidth - pad) {
        left = rect.left - sw - gap
      }
      left = Math.max(pad, left)

      let top = rect.top
      if (top + sh > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - sh - pad)
      }
      setCoords({ top, left })
    }
    place()
    const raf = requestAnimationFrame(place)
    return () => cancelAnimationFrame(raf)
  }, [open, children])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        if (!disabled) setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
          'hover:bg-accent hover:text-accent-foreground',
          open && 'bg-accent text-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-50'
        )}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!disabled) setOpen((v) => !v)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {icon}
        <span className="flex-1 text-start">{label}</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open &&
        createPortal(
          <div
            ref={subRef}
            data-dropdown-submenu
            role="menu"
            className={cn(
              'fixed z-[102] min-w-[11rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
              !coords && 'invisible'
            )}
            style={{ top: coords?.top ?? 0, left: coords?.left ?? 0 }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownCloseContext.Provider
              value={() => {
                setOpen(false)
                closeRoot()
              }}
            >
              {children}
            </DropdownCloseContext.Provider>
          </div>,
          document.body
        )}
    </div>
  )
}
