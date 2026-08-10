import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Plus,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listUsers,
  createUser,
  creatableRoles,
  type UserListItem,
  type UserRole,
} from '@/api/users'
import api, { type PaginationMeta } from '@/api/client'
import { encryptPassword } from '@/lib/crypto'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Loading } from '@/components/Loading'
import { NoResult } from '@/components/NoResult'
import { PaginationBar } from '@/components/PaginationBar'
import { ListToolbar } from '@/components/ListToolbar'
import type { ListToolbarSubmit } from '@/lib/listQuery'
import { SortableHeader, nextSortState, type SortState } from '@/components/SortableHeader'
import { RelativeTime } from '@/components/RelativeTime'

function roleBadgeVariant(role: string) {
  switch (role) {
    case 'superadmin':
      return 'destructive' as const
    case 'admin':
      return 'default' as const
    case 'viewer':
      return 'secondary' as const
    default:
      return 'muted' as const
  }
}

function RowActions({
  row,
  isSelf,
}: {
  row: UserListItem
  isSelf: boolean
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu
      trigger={
        <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
          <MoreHorizontal className="hidden h-4 w-4 md:block" />
          <MoreVertical className="h-4 w-4 md:hidden" />
        </Button>
      }
    >
      <DropdownMenuItem disabled>
        <Eye className="h-4 w-4" />
        {t('common.view')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled>
        <Pencil className="h-4 w-4" />
        {t('common.edit')}
      </DropdownMenuItem>
      {!isSelf && (
        <DropdownMenuItem disabled destructive>
          <Trash2 className="h-4 w-4" />
          {t('common.delete')}
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  )
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
  actorRole,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  actorRole: string
}) {
  const { t } = useTranslation()
  const roles = creatableRoles(actorRole)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('viewer')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setUsername('')
      setPassword('')
      setRole(roles.includes('viewer') ? 'viewer' : roles[0] ?? 'viewer')
      setError('')
      setSubmitting(false)
    }
  }, [open, actorRole]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError(t('users.formRequired'))
      return
    }
    if (!roles.includes(role)) {
      setError(t('users.invalidRole'))
      return
    }
    setSubmitting(true)
    try {
      const { data: keyData } = await api.get<{ publicKey: string }>('/auth/public-key')
      const encrypted = await encryptPassword(password, keyData.publicKey)
      await createUser({
        username: username.trim(),
        password: encrypted,
        role,
      })
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(typeof msg === 'string' ? msg : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !submitting && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="create-user-title"
        className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id="create-user-title" className="text-lg font-semibold">
            {t('users.createTitle')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={submitting}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-username">{t('users.username')}</Label>
            <Input
              id="new-username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('auth.password')}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-role">{t('users.role')}</Label>
            <select
              id="new-role"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={submitting || roles.length === 0}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t(`users.roles.${r}`, { defaultValue: r })}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('users.roleHint')}</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || roles.length === 0}>
              {submitting ? t('common.loading') : t('common.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { t } = useTranslation()
  const { user, hasRole } = useAuth()
  const canWrite = hasRole('superadmin') // backend is superadmin-only for list/create

  const [items, setItems] = useState<UserListItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [toolbarQuery, setToolbarQuery] = useState<ListToolbarSubmit>({
    search: '',
    searchField: 'username',
    filters: [],
    filterLogic: 'AND',
  })
  const [sortState, setSortState] = useState<SortState>({ sortBy: null, sortDir: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listUsers({ page, limit, ...toolbarQuery, sortBy: sortState.sortBy ?? undefined, sortDir: sortState.sortDir ?? undefined })
      // Hide system user (id = 0)
      const filtered = data.items.filter((u) => u.id !== 0)
      setItems(filtered)
      setPagination(data.pagination)
    } catch {
      setError(t('common.error'))
      setItems([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, toolbarQuery, sortState, t])

  useEffect(() => {
    load()
  }, [load])

  function goPrev() {
    setPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setPage((p) => p + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('users.title')}</h1>
        {canWrite && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('users.create')}
          </Button>
        )}
      </div>

      <ListToolbar
        searchFields={[
          { value: 'username', label: t('users.username') },
          { value: 'role', label: t('users.role') },
        ]}
        filterFields={[
          { value: 'username', label: t('users.username'), type: 'string' },
          {
            value: 'role',
            label: t('users.role'),
            type: 'enum',
            options: [
              { value: 'superadmin', label: t('users.roles.superadmin') },
              { value: 'admin', label: t('users.roles.admin') },
              { value: 'viewer', label: t('users.roles.viewer') },
            ],
          },
          { value: 'id', label: 'ID', type: 'number' },
        ]}
        defaultSearchField="username"
        onSubmit={(payload) => {
          setPage(1)
          setToolbarQuery(payload)
        }}
      />

      <div className="pt-1">
        <PaginationBar
          pagination={pagination}
          loading={loading}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <SortableHeader column="username" label={t('users.username')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="role" label={t('users.role')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="created_at" label={t('users.created')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <SortableHeader column="updated_at" label={t('users.updated')} sortBy={sortState.sortBy} sortDir={sortState.sortDir} onSort={(c) => setSortState((s) => nextSortState(s, c))} />
                  <th className="px-4 py-3 text-end font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <Loading fullScreen={false} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <NoResult fullScreen={false} />
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const isSelf = user?.id === row.id
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {row.username}
                          {isSelf && (
                            <Badge variant="outline" className="ms-2 text-[10px]">
                              {t('users.you')}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={roleBadgeVariant(row.role)}>
                            {t(`users.roles.${row.role}`, { defaultValue: row.role })}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <RelativeTime value={row.created_at} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <RelativeTime value={row.updated_at} />
                        </td>
                        <td className="px-4 py-3 text-end">
                          <RowActions row={row} isSelf={isSelf} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y">
            {loading ? (
              <Loading fullScreen={false} />
            ) : items.length === 0 ? (
              <NoResult fullScreen={false} />
            ) : (
              items.map((row) => {
                const isSelf = user?.id === row.id
                return (
                  <div key={row.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium truncate">
                        {row.username}
                        {isSelf && (
                          <Badge variant="outline" className="ms-2 text-[10px]">
                            {t('users.you')}
                          </Badge>
                        )}
                      </p>
                      <Badge variant={roleBadgeVariant(row.role)}>
                        {t(`users.roles.${row.role}`, { defaultValue: row.role })}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        <RelativeTime value={row.created_at} />
                      </p>
                    </div>
                    <RowActions row={row} isSelf={isSelf} />
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <PaginationBar
        pagination={pagination}
        loading={loading}
        onPrev={goPrev}
        onNext={goNext}
      />

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
        actorRole={user?.role ?? 'viewer'}
      />
    </div>
  )
}
