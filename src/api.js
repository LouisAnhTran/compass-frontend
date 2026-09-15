// Compass has no /login endpoint. The frontend authenticates against Staple
// directly and passes the resulting JWT to Compass on every request (SPEC §2).

const API = import.meta.env.VITE_API_URL
const STAPLE = import.meta.env.VITE_STAPLE_GRAPHQL_URL

const LOGIN = `
  mutation login($credential: LoginInput!) {
    login(credential: $credential) { accessToken refreshToken }
  }`

export async function login(email, password) {
  const r = await fetch(STAPLE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: LOGIN, variables: { credential: { email, password } } }),
  })
  const body = await r.json()
  // Staple returns HTTP 200 even on failure — check `errors`, not r.ok.
  if (body.errors) throw new Error(body.errors[0]?.message ?? 'login failed')
  return body.data.login.accessToken
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  }
}

async function request(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  // 401 means the 10h token expired mid-thread. Graph state is untouched —
  // refresh and retry resumes exactly where it paused (SPEC §2.6).
  if (r.status === 401) throw new Error('UNAUTHENTICATED')
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export const api = {
  // One endpoint, three input shapes — routed server-side on snapshot.next.
  turn: (thread_id, input) => request('POST', '/search-agent', { thread_id, input }),
  listConversations: () => request('GET', '/conversations'),
  getConversation: (id) => request('GET', `/conversations/${id}`),
}
