import api, { type PaginatedResponse } from './client'

export type UserRole = 'superadmin' | 'admin' | 'viewer' | string

export interface UserListItem {
  id: number
  username: string
  role: UserRole
  created_at: number
  updated_at: number
}

export async function listUsers(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<PaginatedResponse<UserListItem>>('/auth/users', {
    params: { page: params.page ?? 1, limit: params.limit ?? 20 },
  })
  return data
}

/**
 * Create user. password must be RSA-OAEP base64 ciphertext (same as login).
 */
export async function createUser(body: {
  username: string
  password: string
  role?: UserRole
}) {
  const { data } = await api.post<{ user: UserListItem }>('/auth/users', body)
  return data.user
}

/** Roles strictly below the actor (cannot create equal or higher). */
export function creatableRoles(actorRole: string): UserRole[] {
  if (actorRole === 'superadmin') return ['admin', 'viewer']
  if (actorRole === 'admin') return ['viewer']
  return []
}
