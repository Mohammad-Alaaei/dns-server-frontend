import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Database,
  Server,
  ScrollText,
  MemoryStick,
  Settings,
  Users,
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  Replace,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: ['superadmin', 'admin', 'viewer'] },
  { to: '/records', icon: Database, labelKey: 'nav.records', roles: ['superadmin', 'admin', 'viewer'] },
  { to: '/servers', icon: Server, labelKey: 'nav.servers', roles: ['superadmin', 'admin', 'viewer'] },
  { to: '/rewrite-rules', icon: Replace, labelKey: 'nav.rewriteRules', roles: ['superadmin', 'admin', 'viewer'] },
  { to: '/logs', icon: ScrollText, labelKey: 'nav.logs', roles: ['superadmin'] },
  { to: '/memory', icon: MemoryStick, labelKey: 'nav.memory', roles: ['superadmin', 'admin'] },
  { to: '/users', icon: Users, labelKey: 'nav.users', roles: ['superadmin'] },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings', roles: ['superadmin'] },
]

export default function AppLayout() {
  const { t } = useTranslation()
  const { user, logout, hasRole } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const visibleNav = navItems.filter((item) => hasRole(...item.roles))

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on all sizes so it stays during scroll */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e bg-card transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 lg:justify-center">
          <span className="text-lg font-semibold">{t('app.title')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="shrink-0 border-t px-4 py-3">
          <p className="text-[10px] text-muted-foreground tabular-nums">
            v{__APP_VERSION__}
          </p>
        </div>
      </aside>

      {/* Main area — offset by sidebar width on desktop */}
      <div className="flex min-h-screen flex-col lg:ms-64">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            title={t('common.theme')}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              className="gap-2 cursor-pointer"
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <span className="hidden sm:inline text-sm">{user?.username}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {user?.role}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute end-0 z-50 mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => {
                      setUserMenuOpen(false)
                      navigate('/preferences')
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    {t('nav.preferences')}
                  </button>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-accent"
                    onClick={() => {
                      setUserMenuOpen(false)
                      handleLogout()
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    {t('auth.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
