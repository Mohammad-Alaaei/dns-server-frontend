import { formatFullDateTime, formatRelativeTime } from '@/lib/time'

interface RelativeTimeProps {
  value: number | null | undefined
  className?: string
}

export function RelativeTime({ value, className }: RelativeTimeProps) {
  const relative = formatRelativeTime(value)
  const full = formatFullDateTime(value)
  return (
    <span className={className} title={full || undefined}>
      {relative}
    </span>
  )
}
