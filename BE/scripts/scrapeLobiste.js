/**
 * Scrape registra lobistov z KPK
 * https://www.kpk-rs.si/sl/instituti/lobiranje/register-lobistov
 * Zaženi: node scripts/scrapeLobiste.js [--dry-run]
 */
require('dotenv').config()
const { Pool } = require('pg')

const DRY = process.argv.includes('--dry-run')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const KPK_URL = 'https://www.kpk-rs.si/sl/instituti/lobiranje/register-lobistov'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function poberiLobiste(page) {
  return page.evaluate(() => {
    const lobisti = []

    // Vsak lobist je v svojem elementu — poiščemo s strukturo strani
    // Naslov formata "Priimek, Ime" sledi seznam področij, nato info
    const allEls = [...document.querySelectorAll('h2, h3, h4, .lobist-name, [class*="name"], [class*="title"]')]

    // Alternativa: poiščemo vse elemente ki vsebujejo vejico (format "Priimek, Ime")
    const kandidati = [...document.querySelectorAll('p, div, span, li, h2, h3, h4, strong')]
      .filter(el => {
        const t = el.textContent.trim()
        return t.match(/^[A-ZŠŽČĆĐ][a-zšžčćđ\s-]+,\s+[A-ZŠŽČĆĐ][a-zšžčćđ\s-]+$/)
      })

    kandidati.forEach(el => {
      const ime = el.textContent.trim()
      const parts = ime.split(',').map(s => s.trim())
      if (parts.length !== 2) return

      const priimek = parts[0]
      const imePart = parts[1]

      // Poišči info v bližnjih elementih
      let narocnik = null
      let naslov = null
      let email = null
      let podrocja = null

      // Zajami sorodne elemente po tem elementu
      let next = el.nextElementSibling
      const collected = []
      for (let i = 0; i < 8 && next; i++) {
        const t = next.textContent.trim()
        if (t) collected.push(t)
        next = next.nextElementSibling
      }

      // Poišči email v zbranih tekstih
      collected.forEach(t => {
        if (t.includes('@')) email = t.match(/[\w.+-]+@[\w.+-]+\.\w+/)?.[0] || null
        else if (t.includes('·')) podrocja = t.slice(0, 400)
        else if (!narocnik && t.length > 3 && t.length < 100) narocnik = t
        else if (!naslov && t.match(/\d{4}/)) naslov = t
      })

      lobisti.push({ ime: imePart, priimek, narocnik, naslov, email, podrocja })
    })

    return lobisti
  })
}

async function upsertLobist(l) {
  // 1. Poišči ali ustvari osebo
  let osebaId = null
  const obstojeca = await pool.query(
    `SELECT id FROM osebe WHERE LOWER(ime) = LOWER($1) AND LOWER(priimek) = LOWER($2)`,
    [l.ime, l.priimek]
  )

  if (obstojeca.rows.length) {
    osebaId = obstojeca.rows[0].id
    await pool.query(`UPDATE osebe SET tip = 'lobist' WHERE id = $1`, [osebaId])
  } else {
    const nova = await pool.query(
      `INSERT INTO osebe (ime, priimek, tip) VALUES ($1, $2, 'lobist') RETURNING id`,
      [l.ime, l.priimek]
    )
    osebaId = nova.rows[0].id
  }

  // 2. Upsert lobisti_info
  await pool.query(`
    INSERT INTO lobisti_info (oseba_id, narocnik, vir_url)
    VALUES ($1, $2, $3)
    ON CONFLICT (oseba_id) DO UPDATE SET narocnik = EXCLUDED.narocnik
  `, [osebaId, l.narocnik, KPK_URL])

  return osebaId
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
  await new Promise(r => setTimeout(r, 5000))

  const lobisti = await poberiLobiste(page)
  console.log(`Najdenih: ${lobisti.length} lobistov`)
  lobisti.slice(0, 5).forEach(l => console.log(' ', l.priimek, l.ime, '|', l.narocnik))

  if (!DRY && lobisti.length > 0) {
    let dodanih = 0
    for (const l of lobisti) {
      try {
        await upsertLobist(l)
        dodanih++
        process.stdout.write(`\r  ${dodanih}/${lobisti.length}`)
      } catch (e) {
        console.log(`\nNapaka pri ${l.ime} ${l.priimek}:`, e.message)
      }
    }
    console.log(`\n✓ Vstavljenih: ${dodanih}`)
  } else {
    console.log('(dry-run, nič ni bilo zapisano)')
  }

  await browser.close()
  await pool.end()
}

main().catch(e => { console.error('Napaka:', e.message); process.exit(1) })
