const STORAGE_KEY = 'dns_admin_mxtoolbox_api_key'

export function getMxtoolboxApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setMxtoolboxApiKey(key: string) {
  try {
    const v = key.trim()
    if (v) localStorage.setItem(STORAGE_KEY, v)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
