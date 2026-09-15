// Drives the real UI in a headless browser. Not a test suite — a way to see
// what the page actually does, since building is not rendering.
//
//   node e2e.mjs
//
// Screenshots land in ./shots/.

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const EMAIL = process.env.STAPLE_EMAIL
const PASSWORD = process.env.STAPLE_PASSWORD
const BASE = 'http://localhost:5173'

mkdirSync('shots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })

const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}`))

const shot = async (name) => {
  await page.screenshot({ path: `shots/${name}.png`, fullPage: false })
  console.log(`  📸 ${name}`)
}

console.log('1. load + login')
await page.goto(BASE, { waitUntil: 'networkidle' })
await shot('01-login')

await page.fill('input[name="email"]', EMAIL)
await page.fill('input[name="password"]', PASSWORD)
await page.click('button:has-text("Sign in")')
await page.waitForSelector('text=Search documents in plain English', { timeout: 30000 })
await shot('02-empty')

console.log('2. run a query')
page.on('requestfailed', r => errors.push(`REQFAIL ${r.url()} ${r.failure()?.errorText}`))
page.on('response', r => { if (r.url().includes('8001') && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`) })
await page.fill('input[placeholder*="Singapore"]', 'show me Malaysia E-Invoice documents')
await page.click('form button:text-is("Search")')
try {
  await page.waitForSelector('text=Which document model?', { timeout: 120000 })
} catch (e) {
  await shot('03-FAILED')
  console.log('   page text:', (await page.innerText('main')).slice(0, 400))
  console.log('   errors:', errors)
  await browser.close(); process.exit(1)
}
await shot('03-hitl-model')

console.log('3. confirm the model')
await page.click('li:has-text("Malaysia E-Invoice")')
await page.click('button:has-text("Confirm")')
await page.waitForSelector('text=Which queues?', { timeout: 90000 })
await shot('04-hitl-queues')

console.log('4. confirm no queues -> search')
await page.click('button:has-text("Confirm")')
await page.waitForSelector('text=documents', { timeout: 120000 })
await page.waitForTimeout(1200)
await shot('05-results')

console.log('5. message roles in the transcript')
const roles = await page.evaluate(() =>
  [...document.querySelectorAll('main .flex-1 > div')]
    .map(d => ({
      text: (d.textContent || '').slice(0, 46),
      mine: d.className.includes('self-end'),
    }))
    .filter(r => r.text.trim())
)
roles.forEach(r => console.log(`   ${r.mine ? 'USER →' : '  ← AI'}  ${r.text}`))

console.log('6. click "+ New search"')
await page.click('aside button:has-text("New search")')
await page.waitForTimeout(700)
const cleared = await page.isVisible('text=Search documents in plain English')
const composer = await page.isVisible('input[placeholder*="Singapore"]')
console.log(`   empty state shown: ${cleared}`)
console.log(`   composer shown   : ${composer}`)
await shot('06-after-new-search')

console.log('7. reopen the thread from the sidebar')
await page.click('aside button:has-text("Malaysia")')
await page.waitForTimeout(1500)
await shot('07-reopened')

console.log(errors.length ? `\n❌ console errors:\n${errors.join('\n')}` : '\n✅ no console errors')
await browser.close()
