import { useEffect, useState } from 'react'
import {
  Compass, LogOut, Plus, Search, Loader2, Moon, Sun, FileText, AlertCircle,
} from 'lucide-react'
import { login, api } from './api.js'
import HitlPrompt from './HitlPrompt.jsx'

const newThreadId = () =>
  `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('accessToken'))
  useTheme()

  if (!token) return <Login onToken={setToken} />
  return <Chat onLogout={() => { localStorage.clear(); setToken(null) }} />
}

// ── Theme ────────────────────────────────────────────────────────────────────

function useTheme() {
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const dark = saved ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  }, [])
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }
  return (
    <button onClick={toggle} title="Toggle theme"
            className="p-1.5 rounded-md text-dark-muted hover:text-dark-text hover:bg-dark-surface transition-colors">
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}

// ── Login ────────────────────────────────────────────────────────────────────

function Login({ onToken }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const f = new FormData(e.target)
    try {
      const t = await login(f.get('email'), f.get('password'))
      localStorage.setItem('accessToken', t)
      onToken(t)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit}
            className="w-full max-w-sm bg-dark-surface border border-dark-border rounded-xl p-7 flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <Compass size={22} className="text-dark-accent" />
          <h1 className="text-lg font-semibold tracking-tight">Compass</h1>
        </div>
        <p className="text-xs text-dark-muted leading-relaxed -mt-2">
          Natural-language document search. Sign in with your Staple account.
        </p>

        <Field name="email" type="email" placeholder="you@company.com" label="Email" />
        <Field name="password" type="password" placeholder="••••••••" label="Password" />

        <button disabled={busy}
                className="mt-1 flex items-center justify-center gap-2 bg-dark-accent hover:bg-dark-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50">
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </div>
  )
}

function Field({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-dark-muted uppercase tracking-wide">{label}</span>
      <input {...props} required
             className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-dark-accent/30 focus:border-dark-accent
                        transition-shadow placeholder:text-dark-muted/60" />
    </label>
  )
}

// ── Chat ─────────────────────────────────────────────────────────────────────

function Chat({ onLogout }) {
  const [threadId, setThreadId] = useState(newThreadId)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [awaiting, setAwaiting] = useState(null)
  const [results, setResults] = useState(null)
  const [conversations, setConversations] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refreshList = () => api.listConversations().then(setConversations).catch(() => {})
  useEffect(() => { refreshList() }, [])

  async function send(input) {
    setBusy(true); setError(null)
    try {
      const r = await api.turn(threadId, input)
      setMessages(r.messages ?? [])
      setAwaiting(r.status === 'awaiting_input' ? r.interrupt_payload : null)
      setResults(r.status === 'completed' ? r.results : null)
      refreshList()
    } catch (err) {
      // 401 = the 10h Staple token expired. Graph state is untouched, so
      // signing back in resumes this thread exactly where it paused.
      if (err.message === 'UNAUTHENTICATED') { localStorage.clear(); onLogout() }
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function openThread(id) {
    try {
      const c = await api.getConversation(id)
      setThreadId(id); setMessages(c.messages ?? [])
      setAwaiting(c.awaiting_input ?? null); setResults(null); setError(null)
    } catch (err) { setError(err.message) }
  }

  function startNew() {
    setThreadId(newThreadId()); setMessages([]); setAwaiting(null)
    // setQuery too: unsent composer text belongs to the conversation you just
    // left, so carrying it into a fresh thread is a surprise.
    setResults(null); setError(null); setQuery('')
  }

  return (
    <div className="h-screen grid grid-cols-[240px_1fr]">
      <Sidebar
        conversations={conversations} threadId={threadId}
        onOpen={openThread} onNew={startNew} onLogout={onLogout}
      />

      <main className="flex flex-col min-w-0 bg-dark-bg">
        <header className="flex items-center gap-2 px-6 py-3 border-b border-dark-border flex-shrink-0">
          <Search size={14} className="text-dark-muted" />
          <span className="text-xs text-dark-muted truncate">
            {messages.length ? firstUserMessage(messages) : 'New search'}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {!messages.length && !busy && <EmptyState />}

          {messages.map((m, i) => <Message key={i} msg={m} />)}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-dark-muted">
              <Loader2 size={13} className="animate-spin" /> Working…
            </div>
          )}

          {awaiting && !busy && (
            <HitlPrompt payload={awaiting} disabled={busy} onSubmit={send} />
          )}

          {results && <Results results={results} />}
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        {!awaiting && (
          <form className="flex-shrink-0 border-t border-dark-border px-6 py-4 flex gap-2"
                onSubmit={e => {
                  e.preventDefault()
                  if (query.trim()) { send({ query }); setQuery('') }
                }}>
            <input value={query} disabled={busy} onChange={e => setQuery(e.target.value)}
                   placeholder="e.g. show me Singapore E-invoice documents"
                   className="flex-1 bg-dark-surface border border-dark-border rounded-lg px-3.5 py-2.5 text-sm
                              focus:outline-none focus:ring-2 focus:ring-dark-accent/30 focus:border-dark-accent
                              transition-shadow placeholder:text-dark-muted/60" />
            <button disabled={busy || !query.trim()}
                    className="bg-dark-accent hover:bg-dark-accent-hover text-white text-sm font-medium
                               rounded-lg px-5 transition-colors disabled:opacity-40">
              Search
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

function Sidebar({ conversations, threadId, onOpen, onNew, onLogout }) {
  return (
    <aside className="flex flex-col border-r border-dark-border bg-dark-surface min-h-0">
      <div className="flex items-center justify-between px-3 py-3 border-b border-dark-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-dark-accent" />
          <span className="text-sm font-semibold tracking-tight">Compass</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="px-2 py-2 border-b border-dark-border flex-shrink-0">
        <button onClick={onNew}
                className="w-full flex items-center gap-2 text-xs font-medium text-dark-text
                           hover:bg-dark-bg rounded-md px-2.5 py-2 transition-colors">
          <Plus size={13} /> New search
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {!conversations.length && (
          <p className="text-[11px] text-dark-muted px-3 py-4 text-center leading-relaxed">
            No searches yet.
          </p>
        )}
        {conversations.map(c => (
          <button key={c.thread_id} onClick={() => onOpen(c.thread_id)}
                  className={`w-full text-left mx-2 mb-0.5 px-2.5 py-2 rounded-md transition-colors
                              ${c.thread_id === threadId ? 'bg-dark-bg' : 'hover:bg-dark-bg/60'}`}
                  style={{ width: 'calc(100% - 1rem)' }}>
            <div className="text-xs text-dark-text truncate leading-tight">
              {c.title || 'Untitled'}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                                ${c.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-[10px] text-dark-muted truncate">
                {c.status === 'completed' ? 'Completed' : 'Awaiting input'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex-shrink-0 border-t border-dark-border px-2 py-2">
        <button onClick={onLogout}
                className="w-full flex items-center gap-2 text-[11px] text-dark-muted
                           hover:text-dark-text hover:bg-dark-bg rounded-md px-2.5 py-2 transition-colors">
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </aside>
  )
}

function Message({ msg }) {
  const content = typeof msg === 'string' ? msg : (msg.content ?? '')
  // Assistant turns are the short confirmations the HITL nodes append
  // ("Model: …", "Queues: …"), so they read as a trail of resolved filters.
  const isUser = (msg.type ?? msg.role) === 'human' || (msg.type ?? msg.role) === 'user'

  if (isUser) {
    return (
      <div className="self-end max-w-[70%] bg-dark-accent text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5">
        {content}
      </div>
    )
  }
  return (
    <div className="self-start max-w-[70%] text-sm text-dark-muted flex items-center gap-2">
      <span className="w-1 h-1 rounded-full bg-dark-muted flex-shrink-0" />
      {content}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 grid place-items-center text-center">
      <div className="max-w-sm">
        <Compass size={28} className="text-dark-muted mx-auto mb-3" />
        <p className="text-sm text-dark-text mb-1.5">Search documents in plain English</p>
        <p className="text-xs text-dark-muted leading-relaxed">
          Compass resolves the model, queues and people you mention, then asks
          you to confirm each one before searching.
        </p>
      </div>
    </div>
  )
}

function Results({ results }) {
  const docs = results?.data ?? []
  return (
    <div className="border border-dark-border rounded-xl overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-dark-surface border-b border-dark-border">
        <FileText size={13} className="text-dark-muted" />
        <span className="text-xs font-medium">
          {results?.total ?? 0} document{results?.total === 1 ? '' : 's'}
        </span>
      </div>

      {!docs.length ? (
        <p className="text-xs text-dark-muted px-4 py-6 text-center leading-relaxed">
          No documents matched these filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-dark-muted">
              <tr className="border-b border-dark-border">
                {['Queue ID', 'File', 'Status', 'Uploaded'].map(h => (
                  <th key={h} className="text-left font-medium px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} className="border-b border-dark-border last:border-0 hover:bg-dark-surface/60">
                  <td className="px-4 py-2 text-dark-muted">{d.qid ?? d.id}</td>
                  <td className="px-4 py-2 truncate max-w-xs">{d.fileName}</td>
                  <td className="px-4 py-2">
                    <span className="text-[10px] uppercase tracking-wide text-dark-muted">{d.status}</span>
                  </td>
                  <td className="px-4 py-2 text-dark-muted">{formatDate(d.uploadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ErrorNote({ children }) {
  return (
    <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
      <AlertCircle size={13} className="flex-shrink-0 mt-px" />
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function firstUserMessage(messages) {
  const m = messages[0]
  return (typeof m === 'string' ? m : m?.content) ?? 'New search'
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(Number.isNaN(Number(value)) ? value : Number(value))
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString()
}
