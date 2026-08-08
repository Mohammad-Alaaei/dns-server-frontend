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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    async function restore() {
      const token = getStoredAccessToken()
      const storedUser = getStoredUser()
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const { data } = await api.get<{ id: number; username: string; role: string }>('/auth/me')
        const u: User = { id: data.id, username: data.username, role: data.role }
        setUser(u)
        setStoredUser(u)
      } catch {
        // Token invalid — try refresh path is already in interceptor, else clear
        if (!getStoredRefreshToken()) {
          clearStoredAuth()
        }
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    restore()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    // 1. Fetch public key
    const { data: keyData } = await api.get<{ publicKey: string; algorithm: string; hash: string }>(
      '/auth/public-key'
    )
    // 2. Encrypt password
    const encrypted = await encryptPassword(password, keyData.publicKey)
    // 3. Login
    const { data } = await api.post<AuthResponse>('/auth/login', {
      username,
      password: encrypted,
    })
    setStoredTokens(data.accessToken, data.refreshToken)
    setStoredUser(data.user)
    setUser(data.user)
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
      if (!user) return false
      return roles.includes(user.role)
    },
    [user]
  )

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
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
