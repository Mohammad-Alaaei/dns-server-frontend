/**
 * Relative time from epoch ms (backend bigint timestamps).
 * Returns e.g. "just now", "5 minutes ago", "2 hours ago", "3 days ago".
 */
export function formatRelativeTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'

  const diff = Date.now() - ms
  const abs = Math.abs(diff)
  const past = diff >= 0

  const sec = Math.floor(abs / 1000)
  if (sec < 10) return past ? 'just now' : 'in a moment'
  if (sec < 60) return past ? `${sec} seconds ago` : `in ${sec} seconds`

  const min = Math.floor(sec / 60)
  if (min < 60) return past ? `${min} minute${min === 1 ? '' : 's'} ago` : `in ${min} minute${min === 1 ? '' : 's'}`

  const hr = Math.floor(min / 60)
  if (hr < 24) return past ? `${hr} hour${hr === 1 ? '' : 's'} ago` : `in ${hr} hour${hr === 1 ? '' : 's'}`

  const day = Math.floor(hr / 24)
  if (day < 30) return past ? `${day} day${day === 1 ? '' : 's'} ago` : `in ${day} day${day === 1 ? '' : 's'}`

  const month = Math.floor(day / 30)
  if (month < 12) return past ? `${month} month${month === 1 ? '' : 's'} ago` : `in ${month} month${month === 1 ? '' : 's'}`

  const year = Math.floor(month / 12)
  return past ? `${year} year${year === 1 ? '' : 's'} ago` : `in ${year} year${year === 1 ? '' : 's'}`
}

/** Full local datetime for tooltip */
export function formatFullDateTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return ''
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(ms)
  }
}
