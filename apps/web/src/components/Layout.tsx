import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FlaskConical,
  Layers,
  Network,
  ArrowLeftRight,
  Eye,
  GitCompare,
  FileText,
  StickyNote,
  BookOpen,
  Settings,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
} from 'lucide-react'
import { useLabStore } from '../store/useLabStore'

// ─── Nav configuration ───────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/lab', icon: FlaskConical, label: 'Research Lab' },
  { to: '/scenarios', icon: Layers, label: 'Scenarios' },
  { to: '/topology', icon: Network, label: 'Proxy Stack' },
  { to: '/runs', icon: ArrowLeftRight, label: 'Requests' },
  { to: '/visualizer', icon: Eye, label: 'Visualizer' },
  { to: '/compare', icon: GitCompare, label: 'Comparisons' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/docs', icon: BookOpen, label: 'Documentation' },
  { to: '/settings', icon: Settings, label: 'Settings' },
] as const

// ─── RIFT split-stream mark ───────────────────────────────────────────────────

function RiftMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Incoming stream */}
      <path
        d="M2 14 L10 14"
        stroke="#E85D4A"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Split vertex */}
      <circle cx="12" cy="14" r="2.2" fill="#E85D4A" />
      {/* Upper branch — Frontend / golden */}
      <path
        d="M14 12.5 L24.5 7"
        stroke="#D8AA42"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Lower branch — Backend / iris */}
      <path
        d="M14 15.5 L24.5 21"
        stroke="#9586B8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Endpoint dots */}
      <circle cx="25.5" cy="6.5" r="1.6" fill="#D8AA42" />
      <circle cx="25.5" cy="21.5" r="1.6" fill="#9586B8" />
    </svg>
  )
}

// ─── Sidebar logo ─────────────────────────────────────────────────────────────

interface RiftLogoProps {
  collapsed: boolean
}

function RiftLogo({ collapsed }: RiftLogoProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-5 select-none min-h-[64px]">
      <RiftMark />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="wordmark"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden whitespace-nowrap"
          >
            <span className="text-[15px] font-bold tracking-[0.18em] text-[var(--color-sidebar-text)]">
              RIFT
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  to: string
  icon: React.ElementType
  label: string
  collapsed: boolean
}

function NavItem({ to, icon: Icon, label, collapsed }: NavItemProps) {
  return (
    <li>
      <NavLink
        to={to}
        aria-label={collapsed ? label : undefined}
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
          [
            'flex items-center gap-3 px-3 py-2.5 rounded-control text-sm font-medium transition-colors duration-150',
            isActive
              ? 'bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text)]'
              : 'text-[var(--color-sidebar-muted)] hover:text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)]',
          ].join(' ')
        }
      >
        <Icon size={18} aria-hidden="true" className="shrink-0" />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="overflow-hidden whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </NavLink>
    </li>
  )
}

// ─── Layout shell ─────────────────────────────────────────────────────────────

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useLabStore()

  // Apply theme class to <html> on mount and whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 60 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex flex-col shrink-0 bg-[var(--color-sidebar)] overflow-hidden z-20"
        aria-label="Primary navigation"
      >
        {/* Logo / wordmark */}
        <RiftLogo collapsed={sidebarCollapsed} />

        {/* Hairline divider */}
        <div className="mx-3 h-px bg-white/[0.07]" />

        {/* Navigation links */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          <ul
            role="list"
            className="space-y-px px-2"
            aria-label="Site navigation"
          >
            {NAV_ITEMS.map(({ to, icon, label }) => (
              <NavItem
                key={to}
                to={to}
                icon={icon}
                label={label}
                collapsed={sidebarCollapsed}
              />
            ))}
          </ul>
        </nav>

        {/* Collapse / expand toggle */}
        <div className="px-2 pb-4 pt-2">
          <div className="h-px bg-white/[0.07] mb-3" />
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-sm font-medium text-[var(--color-sidebar-muted)] hover:text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors duration-150"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" className="shrink-0" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" className="shrink-0" />
            )}
            <AnimatePresence initial={false}>
              {!sidebarCollapsed && (
                <motion.span
                  key="collapse-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-end gap-3 px-6 h-[52px] shrink-0 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
          aria-label="Application toolbar"
        >
          {/* Command palette hint */}
          <button
            type="button"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-control border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors duration-150"
            aria-label="Open command palette"
            title="Open command palette (Ctrl+K)"
          >
            <Command size={12} aria-hidden="true" />
            <span className="mono tracking-wide">Ctrl+K</span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-control text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors duration-150"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          tabIndex={-1}
          aria-label="Page content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
