import { useState } from 'react'
import { login, api } from './api.js'

// Backbone placeholder. Real UI renders the three HITL shapes from
// interrupt_payload.items[].sub_reason — see SPEC.md §9.
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('accessToken'))

  async function handleLogin(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const t = await login(f.get('email'), f.get('password'))
    localStorage.setItem('accessToken', t)
    setToken(t)
  }

  if (!token) {
    return (
      <form onSubmit={handleLogin}>
        <input name="email" type="email" placeholder="email" />
        <input name="password" type="password" placeholder="password" />
        <button>Sign in to Staple</button>
      </form>
    )
  }
  return <div>Compass — signed in. Chat UI goes here.</div>
}
