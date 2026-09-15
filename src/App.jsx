import { useEffect, useState } from 'react'
import { login, api } from './api.js'
import HitlPrompt from './HitlPrompt.jsx'

const newThreadId = () =>
  `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('accessToken'))
  const [error, setError] = useState(null)

  if (!token) return <Login onToken={setToken} />
  return <Chat onLogout={() => { localStorage.clear(); setToken(null) }} />
}

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
    <div className="center">
      <form onSubmit={submit} className="card">
        <h1>Compass</h1>
        <p className="muted">Sign in with your Staple account.</p>
        <input name="email" type="email" placeholder="email" required />
        <input name="password" type="password" placeholder="password" required />
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}

function Chat({ onLogout }) {
  const [threadId, setThreadId] = useState(newThreadId)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [awaiting, setAwaiting] = useState(null)   // interrupt_payload
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
      // Exactly one of these is set: the graph either paused at a HITL or ran
      // to completion.
      setAwaiting(r.status === 'awaiting_input' ? r.interrupt_payload : null)
      setResults(r.status === 'completed' ? r.results : null)
      refreshList()
    } catch (err) {
      // 401 means the 10h Staple token expired. Graph state is untouched, so
      // signing back in resumes this thread exactly where it paused.
      if (err.message === 'UNAUTHENTICATED') { localStorage.clear(); onLogout() }
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function openThread(id) {
    const c = await api.getConversation(id)
    setThreadId(id)
    setMessages(c.messages ?? [])
    setAwaiting(c.awaiting_input ?? null)
    setResults(null)
  }

  function startNew() {
    setThreadId(newThreadId()); setMessages([]); setAwaiting(null); setResults(null)
  }

  return (
    <div className="layout">
      <aside>
        <button onClick={startNew}>+ New search</button>
        <ul>
          {conversations.map(c => (
            <li key={c.thread_id}
                className={c.thread_id === threadId ? 'active' : ''}
                onClick={() => openThread(c.thread_id)}>
              <span>{c.title ?? 'Untitled'}</span>
              <small className="muted">{c.status}</small>
            </li>
          ))}
        </ul>
        <button className="ghost" onClick={onLogout}>Sign out</button>
      </aside>

      <main>
        {messages.map((m, i) => (
          <div key={i} className="msg">{m.content ?? String(m)}</div>
        ))}

        {awaiting && (
          <HitlPrompt
            payload={awaiting}
            disabled={busy}
            onSubmit={(input) => send(input)}
          />
        )}

        {results && <Results results={results} />}
        {error && <p className="error">{error}</p>}

        {!awaiting && (
          <form className="composer"
                onSubmit={e => { e.preventDefault(); if (query.trim()) { send({ query }); setQuery('') } }}>
            <input value={query} disabled={busy}
                   onChange={e => setQuery(e.target.value)}
                   placeholder="e.g. find receipts in Q1 from John last week" />
            <button disabled={busy || !query.trim()}>{busy ? '…' : 'Search'}</button>
          </form>
        )}
      </main>
    </div>
  )
}

function Results({ results }) {
  const docs = results?.data ?? []
  return (
    <div className="results">
      <h3>{results?.total ?? 0} document(s)</h3>
      <table>
        <thead><tr><th>ID</th><th>File</th><th>Queue</th><th>Status</th><th>Uploaded</th></tr></thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.id}>
              <td>{d.qid ?? d.id}</td>
              <td>{d.fileName}</td>
              <td>{d.queue?.name}</td>
              <td>{d.status}</td>
              <td>{d.uploadedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
