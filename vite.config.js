import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Staple gates CORS on a WHITELISTED_ORIGINS allowlist. localhost:5173 is not
// on it — a browser preflight to dash-dev returns 405 with no
// Access-Control-Allow-Origin, so calling Staple directly from the page fails
// even though curl succeeds (curl ignores CORS).
//
// Proxying makes the browser talk same-origin; Vite forwards server-side,
// where CORS does not apply. This also means the app is not coupled to
// whichever ports Staple happens to whitelist.
//
// In production the deployed origin must be added to Staple's
// WHITELISTED_ORIGINS, or fronted by the same kind of proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/staple': {
        target: 'https://dash-dev.staple.io',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/staple/, ''),
      },
    },
  },
})
