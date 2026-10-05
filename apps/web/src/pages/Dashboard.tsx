import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  Play,
  RefreshCw,
  ArrowRight,
  Server,
  Globe,
} from 'lucide-react'
import {
  fetchStats,
  fetchRuns,
  fetchScenarios,
  fetchTopology,
  type Run,
  type Stats,
  type Scenario,
  type Topology,
} from '../lib/api'
import { useLabStore } from '../store/useLabStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function statusBadgeClass(status: Run['status']): string {
  switch (status) {
    case 'pass': return 'badge-pass'
    case 'fail': return 'badge-fail'
    case 'error': return 'badge-fail'
    case 'running': return 'badge-warn'
    default: return 'badge-neutral'
  }
}

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-[var(--color-surface-2)] rounded-control animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | undefined
  icon: React.ElementType
  iconClass: string
  loading: boolean
  subtitle?: string
}

function StatCard({ label, value, icon: Icon, iconClass, loading, subtitle }: StatCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="label text-[10px]">{label}</span>
        <Icon size={16} className={iconClass} aria-hidden="true" />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span className="text-3xl font-bold text-[var(--color-text)] tabular-nums">
          {value ?? 0}
        </span>
      )}
      {subtitle && (
        <span className="text-xs text-[var(--color-text-faint)]">{subtitle}</span>
      )}
    </div>
  )
}

// ─── Stats row ────────────────────────────────────────────────────────────────

interface StatsRowProps {
  stats: Stats | undefined
  loading: boolean
}

function StatsRow({ stats, loading }: StatsRowProps) {
  const cards: StatCardProps[] = [
    {
      label: 'Scenarios',
      value: stats?.total,
      icon: Activity,
      iconClass: 'text-[var(--color-text-faint)]',
      loading,
      subtitle: 'total registered',
    },
    {
      label: 'Passed',
      value: stats?.passed,
      icon: CheckCircle2,
      iconClass: 'text-sage',
      loading,
      subtitle: 'clean execution',
    },
    {
      label: 'Failed',
      value: stats?.failed,
      icon: XCircle,
      iconClass: 'text-vermilion',
      loading,
      subtitle: 'divergence detected',
    },
    {
      label: 'Errors',
      value: stats?.errors,
      icon: AlertTriangle,
      iconClass: 'text-golden',
      loading,
      subtitle: 'engine / network',
    },
    {
      label: 'Desync Observed',
      value: stats?.desync_observed,
      icon: Zap,
      iconClass: 'text-vermilion',
      loading,
      subtitle: 'confirmed desyncs',
    },
    {
      label: 'Hardened Blocked',
      value: stats?.hardened_blocked,
      icon: ShieldCheck,
      iconClass: 'text-sage',
      loading,
      subtitle: 'mitigations verified',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  )
}

// ─── Recent runs table ────────────────────────────────────────────────────────

interface RunsTableProps {
  runs: Run[] | undefined
  loading: boolean
  error: Error | null
}

function RunsTable({ runs, loading, error }: RunsTableProps) {
  if (error) {
    return (
      <div
        className="card p-8 flex flex-col items-center justify-center text-center gap-3"
        role="alert"
      >
        <AlertTriangle size={24} className="text-vermilion" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Could not load recent runs. Is the API server running?
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Recent Runs</h2>
        <Link
          to="/runs"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-x-auto" role="region" aria-label="Recent runs">
        <table className="w-full text-sm" aria-busy={loading}>
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {['Scenario', 'Route', 'Status', 'Desync', 'Duration', 'When'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-5 py-3 text-left label text-[10px] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <Skeleton className="h-4 w-full max-w-[80px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : (runs ?? []).slice(0, 10).map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <td className="px-5 py-3.5 max-w-[180px]">
                      <span
                        className="mono text-xs text-[var(--color-text)] truncate block"
                        title={run.scenario_id}
                      >
                        {run.scenario_id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="mono text-xs text-[var(--color-text-muted)]">
                        {run.proxy}
                        <span className="mx-1 opacity-40">→</span>
                        {run.backend}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={statusBadgeClass(run.status)}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {run.divergence ? (
                        <span className="flex items-center gap-1 text-vermilion text-xs font-medium">
                          <AlertTriangle size={12} aria-hidden="true" />
                          yes
                        </span>
                      ) : run.divergence === false ? (
                        <span className="text-xs text-[var(--color-text-faint)]">—</span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-faint)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="mono text-xs text-[var(--color-text-muted)]">
                        {formatDuration(run.duration_ms)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs text-[var(--color-text-faint)]">
                        {formatRelative(run.started_at)}
                      </span>
                    </td>
                  </tr>
                ))}
            {!loading && (runs ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]"
                >
                  No runs yet. Launch a scenario from the Research Lab to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Active environment panel ─────────────────────────────────────────────────

interface EnvPanelProps {
  topology: Topology | undefined
  loading: boolean
}

function EnvPanel({ topology, loading }: EnvPanelProps) {
  const { activeProxy, activeBackend, hardened } = useLabStore()

  const rows = [
    { label: 'Active Proxy', value: activeProxy, icon: Globe },
    { label: 'Active Backend', value: activeBackend, icon: Server },
    {
      label: 'Mode',
      value: hardened ? 'Hardened' : 'Vulnerable',
      icon: ShieldCheck,
      valueClass: hardened ? 'text-sage' : 'text-vermilion',
    },
    {
      label: 'Network',
      value: loading ? null : (topology?.network ?? 'rift_lab'),
      icon: Activity,
    },
  ]

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Active Environment
        </h2>
        <span
          className={hardened ? 'badge-pass' : 'badge-fail'}
          aria-label={hardened ? 'Hardened mode active' : 'Vulnerable mode active'}
        >
          {hardened ? 'Hardened' : 'Vulnerable'}
        </span>
      </div>

      <dl className="divide-y divide-[var(--color-border)]">
        {rows.map(({ label, value, icon: Icon, valueClass = '' }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5">
            <dt className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Icon size={13} aria-hidden="true" />
              {label}
            </dt>
            <dd>
              {loading && !value ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span
                  className={`mono text-xs font-medium text-[var(--color-text)] ${valueClass}`}
                >
                  {value ?? '—'}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* Proxy / backend service status */}
      {!loading && topology && (
        <div className="px-5 pb-4 pt-2">
          <p className="label text-[9px] mb-2">Proxy services</p>
          <div className="flex flex-wrap gap-2">
            {topology.proxies.map((svc) => (
              <div key={svc.id} className="flex items-center gap-1.5">
                <span
                  className={`status-dot ${svc.status === 'running' ? 'status-dot-running' : svc.status === 'ready' ? 'status-dot-ready' : 'status-dot-error'}`}
                  aria-hidden="true"
                />
                <span className="mono text-[11px] text-[var(--color-text-muted)]">
                  {svc.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quick launch panel ───────────────────────────────────────────────────────

interface QuickLaunchProps {
  scenarios: Scenario[] | undefined
  loading: boolean
}

function QuickLaunch({ scenarios, loading }: QuickLaunchProps) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Quick Launch</h2>
        <Link
          to="/scenarios"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1 transition-colors"
        >
          All scenarios <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>

      <ul role="list" className="divide-y divide-[var(--color-border)]">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-14" />
              </li>
            ))
          : (scenarios ?? []).slice(0, 7).map((scenario) => (
              <li key={scenario.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p
                    className="mono text-xs text-[var(--color-text)] truncate"
                    title={scenario.name}
                  >
                    {scenario.name}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5 capitalize">
                    {scenario.protocol} · {scenario.category}
                  </p>
                </div>
                <Link
                  to={`/lab?scenario=${scenario.id}`}
                  className="btn-ghost text-xs px-3 py-1.5 shrink-0"
                  aria-label={`Launch scenario ${scenario.name}`}
                >
                  <Play size={12} aria-hidden="true" />
                  Run
                </Link>
              </li>
            ))}
        {!loading && (scenarios ?? []).length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">
            No scenarios found. Is the API server running?
          </li>
        )}
      </ul>
    </div>
  )
}

// ─── Protocol coverage matrix ─────────────────────────────────────────────────

type CoverageVariant = {
  variant: string
  description: string
  status: 'ready' | 'experimental' | 'simulated'
}

type CoverageGroup = {
  protocol: string
  variants: CoverageVariant[]
}

const COVERAGE: CoverageGroup[] = [
  {
    protocol: 'HTTP/1.1',
    variants: [
      {
        variant: 'CL.TE',
        description: 'Content-Length wins at frontend, Transfer-Encoding at backend',
        status: 'ready',
      },
      {
        variant: 'TE.CL',
        description: 'Transfer-Encoding wins at frontend, Content-Length at backend',
        status: 'ready',
      },
      {
        variant: 'CL.0',
        description: 'Zero Content-Length bypass for chunked backend tunneling',
        status: 'ready',
      },
      {
        variant: 'PAUSE',
        description: 'Timing-based injection leveraging partial request pauses',
        status: 'ready',
      },
    ],
  },
  {
    protocol: 'HTTP/2',
    variants: [
      {
        variant: 'H2.CL',
        description: 'HTTP/2 to HTTP/1.1 downgrade with injected Content-Length',
        status: 'experimental',
      },
      {
        variant: 'H2.TE',
        description: 'HTTP/2 downgrade injecting Transfer-Encoding: chunked',
        status: 'experimental',
      },
    ],
  },
  {
    protocol: 'Browser',
    variants: [
      {
        variant: 'CSD',
        description: 'Client-Side Desync via browser-initiated ambiguous requests',
        status: 'simulated',
      },
    ],
  },
]

function statusBadge(status: CoverageVariant['status']) {
  switch (status) {
    case 'ready': return 'badge-pass'
    case 'experimental': return 'badge-warn'
    case 'simulated': return 'badge-info'
  }
}

function ProtocolCoverage() {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Protocol Coverage
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Attack variants implemented in the engine
        </p>
      </div>

      <div className="overflow-x-auto" role="region" aria-label="Protocol coverage">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {['Protocol', 'Variant', 'Status', 'Description'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-5 py-3 text-left label text-[10px]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COVERAGE.flatMap(({ protocol, variants }) =>
              variants.map((v, i) => (
                <tr
                  key={`${protocol}-${v.variant}`}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    {i === 0 ? (
                      <span className="mono text-xs font-semibold text-[var(--color-text)]">
                        {protocol}
                      </span>
                    ) : (
                      <span className="mono text-xs text-[var(--color-surface-2)] select-none">
                        {protocol}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="mono text-xs font-semibold text-[var(--color-text)]">
                      {v.variant}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={statusBadge(v.status)}>{v.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[var(--color-text-muted)] max-w-xs">
                    {v.description}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-control border border-vermilion/30 bg-vermilion/10 text-sm text-vermilion"
      role="alert"
    >
      <AlertTriangle size={16} aria-hidden="true" />
      {message}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 15_000,
  })

  const {
    data: runs,
    isLoading: runsLoading,
    error: runsError,
  } = useQuery({
    queryKey: ['runs', 10],
    queryFn: () => fetchRuns(10),
    refetchInterval: 10_000,
  })

  const {
    data: scenarios,
    isLoading: scenariosLoading,
  } = useQuery({
    queryKey: ['scenarios'],
    queryFn: fetchScenarios,
    staleTime: 60_000,
  })

  const {
    data: topology,
    isLoading: topologyLoading,
  } = useQuery({
    queryKey: ['topology'],
    queryFn: fetchTopology,
    refetchInterval: 20_000,
  })

  const { hardened } = useLabStore()

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            Research Workstation
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            HTTP desync research at a glance
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hardened && (
            <span className="badge-pass flex items-center gap-1.5">
              <ShieldCheck size={12} aria-hidden="true" />
              Hardened Mode
            </span>
          )}
          <Link to="/lab" className="btn-primary text-sm">
            <Play size={15} aria-hidden="true" />
            Open Lab
          </Link>
        </div>
      </motion.div>

      {/* ── API error banners ────────────────────────────────────────────── */}
      {statsError && (
        <ErrorBanner message="Could not load stats — is the API server running at localhost:8000?" />
      )}

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <motion.section
        aria-labelledby="stats-heading"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <h2 id="stats-heading" className="sr-only">
          Run statistics
        </h2>
        <motion.div variants={itemVariants}>
          <StatsRow stats={stats} loading={statsLoading} />
        </motion.div>
      </motion.section>

      {/* ── Main grid: runs + sidebar ────────────────────────────────────── */}
      <motion.div
        className="grid lg:grid-cols-[1fr_340px] gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Runs table */}
        <motion.section aria-labelledby="runs-heading" variants={itemVariants}>
          <h2 id="runs-heading" className="sr-only">
            Recent runs
          </h2>
          <RunsTable
            runs={runs}
            loading={runsLoading}
            error={runsError as Error | null}
          />
        </motion.section>

        {/* Right sidebar: environment + quick launch */}
        <motion.div className="space-y-6" variants={containerVariants}>
          <motion.section aria-labelledby="env-heading" variants={itemVariants}>
            <h2 id="env-heading" className="sr-only">
              Active environment
            </h2>
            <EnvPanel topology={topology} loading={topologyLoading} />
          </motion.section>

          <motion.section aria-labelledby="quick-launch-heading" variants={itemVariants}>
            <h2 id="quick-launch-heading" className="sr-only">
              Quick launch
            </h2>
            <QuickLaunch scenarios={scenarios} loading={scenariosLoading} />
          </motion.section>
        </motion.div>
      </motion.div>

      {/* ── Protocol coverage ────────────────────────────────────────────── */}
      <motion.section
        aria-labelledby="coverage-heading"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.45 }}
      >
        <h2 id="coverage-heading" className="sr-only">
          Protocol coverage matrix
        </h2>
        <ProtocolCoverage />
      </motion.section>

      {/* ── Refresh hint ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-faint)]">
        <RefreshCw size={10} aria-hidden="true" />
        Stats refresh every 15 s · Runs every 10 s
      </div>
    </div>
  )
}
