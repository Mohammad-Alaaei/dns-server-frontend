import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-3', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1 min-w-0">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              )}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="truncate hover:text-foreground hover:underline cursor-pointer"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'truncate',
                    isLast && 'font-medium text-foreground'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
