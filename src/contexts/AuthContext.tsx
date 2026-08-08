import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import api, {
  type AuthResponse,
  type User,
  clearStoredAuth,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUser,
  setStoredTokens,
  setStoredUser,
} from '@/api/client'
import { encryptPassword } from '@/lib/crypto'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  // Support both { user: {...} } and flat { id, username, role }
  const src =
    obj.user && typeof obj.user === 'object'
      ? (obj.user as Record<string, unknown>)
      : obj
  const id = Number(src.id)
  const username = typeof src.username === 'string' ? src.username : ''
  const role = typeof src.role === 'string' ? src.role : ''
  if (!Number.isFinite(id) || id < 1 || !username || !role) return null
  return { id, username, role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from localStorage immediately so refresh doesn't blank the shell
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [isLoading, setIsLoading] = useState(() => !!getStoredAccessToken())

  // Validate / refresh session on mount
  useEffect(() => {
    async function restore() {
      const token = getStoredAccessToken()
      if (!token) {
        setUser(null)
        setIsLoading(false)
        return
      }

      // Keep stored user visible while we revalidate
      const cached = getStoredUser()
      if (cached) setUser(cached)

      try {
        // Backend: GET /api/auth/me → { user: { id, username, role } }
        const { data } = await api.get<unknown>('/auth/me')
        const u = normalizeUser(data)
        if (!u) {
          throw new Error('Invalid /auth/me payload')
        }
        setUser(u)
        setStoredUser(u)
      } catch {
        // Interceptor may have already tried refresh. If we still fail, drop session
        // only when there is no usable refresh token left (interceptor clears on hard fail).
        const stillHasToken = !!getStoredAccessToken()
        if (!stillHasToken && !getStoredRefreshToken()) {
          clearStoredAuth()
          setUser(null)
        } else if (!stillHasToken) {
          clearStoredAuth()
          setUser(null)
        }
        // If token still exists but /me failed for another reason, keep cached user
      } finally {
        setIsLoading(false)
      }
    }
    restore()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { data: keyData } = await api.get<{ publicKey: string; algorithm: string; hash: string }>(
      '/auth/public-key'
    )
    const encrypted = await encryptPassword(password, keyData.publicKey)
    const { data } = await api.post<AuthResponse>('/auth/login', {
      username,
      password: encrypted,
    })
    setStoredTokens(data.accessToken, data.refreshToken)
    const u = normalizeUser(data.user) ?? data.user
    setStoredUser(u)
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      clearStoredAuth()
      setUser(null)
    }
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { data: keyData } = await api.get<{ publicKey: string }>('/auth/public-key')
    const currentEnc = await encryptPassword(currentPassword, keyData.publicKey)
    const newEnc = await encryptPassword(newPassword, keyData.publicKey)
    await api.post('/auth/change-password', {
      currentPassword: currentEnc,
      newPassword: newEnc,
    })
  }, [])

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!user?.role) return false
      return roles.includes(user.role)
    },
    [user]
  )

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user?.id && !!user?.role,
      isLoading,
      login,
      logout,
      changePassword,
      hasRole,
    }),
    [user, isLoading, login, logout, changePassword, hasRole]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
