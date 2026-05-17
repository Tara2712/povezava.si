/**
 * Scrape registra lobistov z KPK (kpk-rs.si)
 * Zaženi: node scripts/scrapeLobiste.js [--dry-run]
 */
require('dotenv').config()
const { Pool } = require('pg')

const DRY = process.argv.includes('--dry-run')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const KPK_URL = 'https://www.kpk-rs.si/sl/register-lobistov/'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function scrapePage(page) {
  return page.evaluate(() => {
    const rows = []
    // Išči tabelo z lobisti
    document.querySelectorAll('table tbody tr, .lobist-row, [class*="lobist"]').forEach(row => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 2) {
        rows.push({
          raw: [...cells].map(c => c.textContent.trim()),
          html: row.innerHTML.slice(0, 200)
        })
      }
    })
    // Alternativno — poišči vse kar vsebuje ime + registrska
    const allText = document.body.innerText.slice(0, 5000)
    return { rows: rows.slice(0, 5), bodySnippet: allText }
  })
}

async function main() {
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: ['--no-sandbox'],
  })

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  console.log('Nalagam KPK register lobistov...')
  await page.goto(KPK_URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 4000))

  const data = await scrapePage(page)
  console.log('\n=== Vzorec strani ===')
  console.log(data.bodySnippet)
  console.log('\n=== Vrstice tabele (prve 5) ===')
  data.rows.forEach((r, i) => console.log(`${i}:`, r.raw))

  await browser.close()
  await pool.end()
}

main().catch(e => { console.error('Napaka:', e.message); process.exit(1) })
