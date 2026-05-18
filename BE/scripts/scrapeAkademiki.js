/**
 * Scraper za osebje ii.feri.um.si
 * Uporabi: node scripts/scrapeAkademiki.js [--dry-run]
 *
 * --dry-run  samo izpiše najdene osebe, ne vstavlja v bazo
 */
require('dotenv').config()
const { Pool } = require('pg')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL    = 'https://ii.feri.um.si/sl/o-institutu/osebje/'
const INST   = 'UM FERI — Inštitut za informatiko'
const DRY    = process.argv.includes('--dry-run')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// ── Pomožne funkcije ────────────────────────────────────────────────────────

function razstaviIme(polnoIme) {
  // Odstrani akademske nazive (prof., dr., mag., asist., ...)
  const cleaned = polnoIme
    .replace(/\b(prof\.|dr\.|mag\.|asist\.|doc\.|red\.|izr\.|univ\.|dipl\.|ing\.)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return { ime: parts[0], priimek: '' }

  // Zadnja beseda je priimek (v slovenščini je priimek ponavadi zadnji)
  const priimek = parts[parts.length - 1]
  const ime = parts.slice(0, -1).join(' ')
  return { ime, priimek }
}

// ── Glavna logika ────────────────────────────────────────────────────────────

async function scrapiStran(page) {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('.staff_image_border', { timeout: 15000 })
  await new Promise(r => setTimeout(r, 1000))

  const osebe = await page.evaluate(() => {
    const seen = new Set()
    return [...document.querySelectorAll('.staff_image_border')].map(card => {
      const img    = card.querySelector('img')
      const ime    = img?.alt?.trim() || ''
      // naziv je ponavadi v elementu znotraj kartice (span, p, div z razredom position/title)
      const naziv  = (
        card.querySelector('.staff_position, .position, .title, [class*="position"], [class*="title"]')?.textContent ||
        card.querySelector('span:not(.full_cont_main_picture), p')?.textContent ||
        ''
      ).trim().replace(/\s+/g, ' ')

      return { ime, naziv, foto: img?.src || '' }
    }).filter(o => {
      if (!o.ime || !o.ime.includes(' ')) return false
      if (seen.has(o.ime)) return false
      seen.add(o.ime)
      return true
    })
  })

  return osebe
}

async function vstaviVBazo(oseba, ime, priimek) {
  // Preveri ali oseba že obstaja
  const obstoječa = await pool.query(
    `SELECT id FROM osebe WHERE LOWER(ime) = LOWER($1) AND LOWER(priimek) = LOWER($2)`,
    [ime, priimek]
  )

  if (obstoječa.rows.length > 0) {
    // Posodobi fotografijo in institucijo
    await pool.query(
      `UPDATE osebe SET fotografija_url = $1, institucija = $2, naziv = $3, tip = 'akademik'
       WHERE id = $4`,
      [oseba.foto || null, INST, oseba.naziv || null, obstoječa.rows[0].id]
    )
    return 'posodobljen'
  }

  // Vstavi novo osebo
  await pool.query(
    `INSERT INTO osebe (ime, priimek, tip, fotografija_url, institucija, naziv)
     VALUES ($1, $2, 'akademik', $3, $4, $5)`,
    [ime, priimek, oseba.foto || null, INST, oseba.naziv || null]
  )
  return 'dodan'
}

async function main() {
  console.log(`Scraperjem ${URL}`)
  console.log(DRY ? '(DRY RUN — ne vstavlja v bazo)\n' : '')

  const { default: puppeteer } = await import('puppeteer-core')

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  let osebe = []
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    osebe = await scrapiStran(page)
  } finally {
    await browser.close()
  }

  console.log(`Najdenih ${osebe.length} zapisov:\n`)

  if (osebe.length === 0) {
    console.log('⚠  Ni najdenih oseb. Stran morda nalaga vsebino drugače.')
    console.log('   Poskusi zagnati z --debug zastavico za ogled HTML-ja.')
    await pool.end()
    return
  }

  let dodanih = 0, posodobljenih = 0, preskočenih = 0

  for (const o of osebe) {
    const razstavljeno = razstaviIme(o.ime)
    if (!razstavljeno || !razstavljeno.ime) { preskočenih++; continue }

    const { ime, priimek } = razstavljeno
    console.log(`  ${o.naziv ? `[${o.naziv}]` : ''} ${ime} ${priimek}${o.foto ? ' 📷' : ''}`)

    if (!DRY) {
      const status = await vstaviVBazo(o, ime, priimek)
      if (status === 'dodan') dodanih++
      else posodobljenih++
    }
  }

  console.log(`\nSkupaj: ${dodanih} dodanih, ${posodobljenih} posodobljenih, ${preskočenih} preskočenih`)
  await pool.end()
}

main().catch(e => { console.error('Napaka:', e.message); process.exit(1) })
