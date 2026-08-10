import api from './client'

/** Live system settings blob (config.system). */
export interface SystemSettings {
  cache: {
    level: 'ALL' | 'CUSTOM_ONLY' | 'FILTERED_ONLY' | 'NONE' | string
    expireTime: number
    flushInterval: number
    filterIps: string[]
  }
  ignoreIps: string[]
  dns: {
    ttl: number
    timeout: number
  }
  server: {
    ptrHostname: string
    debugPrefix: string
  }
}

export interface UserSettings {
  language?: string
  theme?: 'system' | 'light' | 'dark' | string
  darkMode?: boolean
}

export async function getSystemSettings() {
  const { data } = await api.get<{ settings: SystemSettings }>('/settings/system')
  return data.settings
}

export async function patchSystemSettings(patch: Partial<SystemSettings> | Record<string, unknown>) {
  const { data } = await api.patch<{ settings: SystemSettings }>('/settings/system', patch)
  return data.settings
}

export async function getMySettings() {
  const { data } = await api.get<{ settings: UserSettings }>('/settings/me')
  return data.settings
}

export async function patchMySettings(patch: Partial<UserSettings>) {
  const { data } = await api.patch<{ settings: UserSettings }>('/settings/me', patch)
  return data.settings
}
