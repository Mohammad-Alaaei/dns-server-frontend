/** Session-backed CNAME create/edit wizard stack */

const KEY = 'dns_record_wizard'

export interface WizardFrame {
  /** Record id after it was created/opened */
  recordId?: number
  domain: string
}

export interface WizardState {
  /** Previous steps for Back navigation */
  stack: WizardFrame[]
  /** Domains still to process (CNAME targets), FIFO */
  queue: string[]
  /** Root mode context */
  origin: 'create' | 'edit'
}

export function loadWizard(): WizardState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as WizardState
  } catch {
    return null
  }
}

export function saveWizard(state: WizardState | null) {
  try {
    if (!state || (state.stack.length === 0 && state.queue.length === 0)) {
      sessionStorage.removeItem(KEY)
    } else {
      sessionStorage.setItem(KEY, JSON.stringify(state))
    }
  } catch {
    /* ignore */
  }
}

export function clearWizard() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Append unique CNAME targets to the end of the queue (skip current domain). */
export function enqueueCnames(
  state: WizardState,
  cnames: string[],
  currentDomain: string
): WizardState {
  const existing = new Set(
    [...state.queue, ...state.stack.map((s) => s.domain), currentDomain].map((d) =>
      d.toLowerCase()
    )
  )
  const next = [...state.queue]
  for (const c of cnames) {
    const d = c.trim().toLowerCase().replace(/\.$/, '')
    if (!d || existing.has(d)) continue
    existing.add(d)
    next.push(d)
  }
  return { ...state, queue: next }
}
