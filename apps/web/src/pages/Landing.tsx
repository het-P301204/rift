import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Cpu, GitCompare, Shield } from 'lucide-react'
import { useLabStore } from '../store/useLabStore'

// ─── Feature card data ────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Cpu,
    color: 'text-vermilion',
    bg: 'bg-vermilion/10',
    title: 'Protocol Engine',
    description:
      'Raw socket-level request construction for CL.TE, TE.CL, H2.CL, H2.TE, CL.0, ' +
      'pause-based, and client-side desync attacks. No HTTP library abstractions — ' +
      'byte-precise payloads that expose how each tier parses the stream.',
  },
  {
    icon: GitCompare,
    color: 'text-golden',
    bg: 'bg-golden/10',
    title: 'Differential Analysis',
    description:
      'Observe real-time divergence between what the frontend proxy and backend ' +
      'server parsed from the same byte stream. See exactly which header or byte ' +
      'caused the split that opens the desync window.',
  },
  {
    icon: Shield,
    color: 'text-sage',
    bg: 'bg-sage/10',
    title: 'Hardened Mode',
    description:
      'Toggle a fully mitigated proxy stack and run the same scenarios to confirm ' +
      'defenses hold. Compare pass/fail ratios between vulnerable and hardened ' +
      'configurations to validate your remediation strategy.',
  },
]

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] },
  },
}

const featureVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
}

// ─── Animated split-stream diagram ───────────────────────────────────────────

function StreamDiagram() {
  return (
    <div
      className="relative w-full max-w-2xl mx-auto mt-2"
      role="img"
      aria-label={
        'Diagram showing a single HTTP byte stream entering from the left, ' +
        'hitting the RIFT EVENT split point in the center, then diverging into ' +
        'two paths: Frontend sees 1 message (golden) and Backend sees 2 messages (iris).'
      }
    >
      <svg
        viewBox="0 0 620 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-card border border-[var(--color-border)]"
        style={{ background: 'var(--color-surface)' }}
      >
        {/* ── Labels ── */}
        <text
          x="30"
          y="24"
          fontSize="9"
          fill="currentColor"
          opacity="0.35"
          fontFamily="'IBM Plex Mono', monospace"
          letterSpacing="1.5"
        >
          ONE BYTE STREAM
        </text>

        {/* ── Incoming stream line (static) ── */}
        <line
          x1="30"
          y1="100"
          x2="246"
          y2="100"
          stroke="#E85D4A"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.25"
        />

        {/* ── Flowing byte packets ── */}
        {([0, 1, 2, 3] as const).map((i) => (
          <motion.rect
            key={i}
            y={94}
            width={16}
            height={12}
            rx={4}
            fill="#E85D4A"
            initial={{ x: 30 + i * 36, opacity: 0.9 }}
            animate={{
              x: [30 + i * 36, 220],
              opacity: [0.9, 0.9, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.5,
              times: [0, 0.8, 1],
            }}
          />
        ))}

        {/* ── Split vertex ── */}
        <motion.circle
          cx="258"
          cy="100"
          r="10"
          fill="#E85D4A"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 280, damping: 20 }}
        />

        {/* ── Animated incoming stream path ── */}
        <motion.path
          d="M30 100 L248 100"
          stroke="#E85D4A"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />

        {/* ── RIFT EVENT label ── */}
        <motion.text
          x="258"
          y="124"
          fontSize="8.5"
          textAnchor="middle"
          fill="#E85D4A"
          fontFamily="'IBM Plex Mono', monospace"
          letterSpacing="0.5"
          initial={{ opacity: 0, y: 130 }}
          animate={{ opacity: 1, y: 124 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          RIFT EVENT
        </motion.text>

        {/* ── Upper branch (Frontend / golden) ── */}
        <motion.path
          d="M268 93 L488 52"
          stroke="#D8AA42"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.55, ease: 'easeOut' }}
        />

        {/* ── Lower branch (Backend / iris) ── */}
        <motion.path
          d="M268 107 L488 148"
          stroke="#9586B8"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.55, ease: 'easeOut' }}
        />

        {/* ── Divergence label ── */}
        <motion.text
          x="380"
          y="104"
          fontSize="8.5"
          textAnchor="middle"
          fill="currentColor"
          opacity="0"
          fontFamily="'IBM Plex Mono', monospace"
          letterSpacing="0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1.4, duration: 0.5 }}
        >
          divergence ↕
        </motion.text>

        {/* ── Frontend endpoint chip ── */}
        <motion.g
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.4, duration: 0.4 }}
        >
          <rect x="496" y="32" width="108" height="40" rx="10" fill="#D8AA42" opacity="0.12" />
          <rect x="496" y="32" width="108" height="40" rx="10" stroke="#D8AA42" strokeWidth="0.8" opacity="0.25" fill="none" />
          <text x="550" y="49" fontSize="8.5" textAnchor="middle" fill="#D8AA42" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.5">
            FRONTEND
          </text>
          <text x="550" y="63" fontSize="8" textAnchor="middle" fill="#D8AA42" opacity="0.6" fontFamily="'IBM Plex Mono', monospace">
            1 message
          </text>
        </motion.g>

        {/* ── Backend endpoint chip ── */}
        <motion.g
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.4, duration: 0.4 }}
        >
          <rect x="496" y="128" width="108" height="40" rx="10" fill="#9586B8" opacity="0.12" />
          <rect x="496" y="128" width="108" height="40" rx="10" stroke="#9586B8" strokeWidth="0.8" opacity="0.25" fill="none" />
          <text x="550" y="145" fontSize="8.5" textAnchor="middle" fill="#9586B8" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.5">
            BACKEND
          </text>
          <text x="550" y="159" fontSize="8" textAnchor="middle" fill="#9586B8" opacity="0.6" fontFamily="'IBM Plex Mono', monospace">
            2 messages
          </text>
        </motion.g>
      </svg>
    </div>
  )
}

// ─── RIFT mark (header) ───────────────────────────────────────────────────────

function HeaderMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M2 14 L10 14" stroke="#E85D4A" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="14" r="2.2" fill="#E85D4A" />
      <path d="M14 12.5 L24.5 7" stroke="#D8AA42" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 15.5 L24.5 21" stroke="#9586B8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="25.5" cy="6.5" r="1.6" fill="#D8AA42" />
      <circle cx="25.5" cy="21.5" r="1.6" fill="#9586B8" />
    </svg>
  )
}

// ─── Landing page ─────────────────────────────────────────────────────────────

export default function Landing() {
  const { theme } = useLabStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      {/* ── Minimal header ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <HeaderMark />
          <span className="text-sm font-bold tracking-[0.18em] text-[var(--color-text)]">
            RIFT
          </span>
        </div>
        <Link
          to="/dashboard"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors duration-150"
        >
          Dashboard →
        </Link>
      </header>

      {/* ── Hero section ────────────────────────────────────────────────── */}
      <section
        className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center"
        aria-labelledby="hero-headline"
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto w-full"
        >
          {/* Eyebrow label */}
          <motion.p variants={fadeUp} className="label mb-7">
            HTTP Request Smuggling — Local Research Platform
          </motion.p>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            id="hero-headline"
            className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-[var(--color-text)] leading-[1.08] mb-7"
          >
            When two HTTP tiers{' '}
            <span className="text-vermilion">disagree,</span>
            <br className="hidden sm:block" />
            {' '}the request becomes{' '}
            <span className="text-vermilion">the attack surface.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            className="text-[1.0625rem] text-[var(--color-text-muted)] leading-relaxed mb-10 max-w-[540px] mx-auto"
          >
            RIFT is a local research workstation for HTTP desync. Construct byte-precise
            payloads, watch the frontend and backend parse them differently in real time,
            and verify that your mitigations hold under hardened mode.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-16"
          >
            <Link
              to="/lab"
              className="btn-primary text-[0.9375rem] px-6 py-3 justify-center"
            >
              Launch Research Lab
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              to="/scenarios"
              className="btn-secondary text-[0.9375rem] px-6 py-3 justify-center"
            >
              Explore a Scenario
            </Link>
          </motion.div>

          {/* Animated stream diagram */}
          <motion.div variants={fadeUp}>
            <StreamDiagram />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Feature cards ───────────────────────────────────────────────── */}
      <section
        className="border-t border-[var(--color-border)] px-6 py-20"
        aria-labelledby="features-heading"
      >
        <div className="max-w-5xl mx-auto">
          <motion.p
            id="features-heading"
            className="label text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Research Capabilities
          </motion.p>

          <motion.div
            className="grid sm:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {FEATURES.map(({ icon: Icon, color, bg, title, description }) => (
              <motion.article
                key={title}
                variants={featureVariants}
                className="card p-6 flex flex-col"
              >
                <div
                  className={`w-10 h-10 rounded-control flex items-center justify-center mb-4 shrink-0 ${bg}`}
                >
                  <Icon size={20} className={color} aria-hidden="true" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">
                  {title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {description}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--color-border)] px-8 py-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-text-faint)]">
          HTTP Protocol Security Research — Controlled Local Environment
        </p>
        <p className="mono text-xs text-[var(--color-text-faint)]">
          RIFT v0.1.0
        </p>
      </footer>
    </div>
  )
}
