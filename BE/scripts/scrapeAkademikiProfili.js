/**
 * Scrape individualnih profilov profesorjev z ii.feri.um.si
 * Vzame URL-je z glavne strani (/sl/person/[slug]/), nato obišče vsak profil in shrani:
 * - opis (.cont_categ — laboratorij, vloga)
 * - podrocja (področja raziskovanja)
 * - profil_url
 *
 * Zaženi: node scripts/scrapeAkademikiProfili.js [--dry-run]
 */
require('dotenv').config()
const { Pool } = require('pg')

const CHROME  = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OSNOVA  = 'https://ii.feri.um.si/sl/o-institutu/osebje/'
const DRY     = process.argv.includes('--dry-run')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function makePage(browser) {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'sl-SI,sl;q=0.9,en;q=0.8' })
  return page
}

// ── Pridobi URL-je profilov z glavne strani ──────────────────────────────────

async function pridobi_profile_url(page) {
  await page.goto(OSNOVA, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('.staff_image_border', { timeout: 15000 })
  await new Promise(r => setTimeout(r, 1000))

  return page.evaluate(() => {
    const seen = new Set()
    return [...document.querySelectorAll('.staff_image_border')].map(card => {
      const img  = card.querySelector('img')
      const ime  = img?.alt?.trim() || ''
      if (!ime || !ime.includes(' ') || seen.has(ime)) return null
      seen.add(ime)

      // URL is on an ancestor link wrapping the card
      let el = card
      let url = ''
      for (let i = 0; i < 6; i++) {
        el = el.parentElement
        if (!el) break
        if (el.tagName === 'A') { url = el.href; break }
        const a = el.querySelector('a')
        if (a) { url = a.href; break }
      }

      return { ime, url }
    }).filter(Boolean)
  })
}

// ── Scrape posameznega profila ───────────────────────────────────────────────

async function scrapiProfil(page, url) {
  if (!url) return { opis: null, podrocja: null }
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
    await new Promise(r => setTimeout(r, 800))

    return page.evaluate(() => {
      const sc = document.querySelector('.single_contact_content')
      if (!sc) return { opis: null, podrocja: null }

      // Vloga in laboratorij iz .cont_categ
      const opis = sc.querySelector('.cont_categ')?.textContent?.trim()?.slice(0, 500) || null

      // Področja raziskovanja — H2/H3 z "področj" / "razisk" / "research", nato LI-ji
      let podrocja = null
      const headings = sc.querySelectorAll('h2, h3, h4')
      for (const h of headings) {
        const txt = h.textContent.toLowerCase()
        if (txt.includes('področj') || txt.includes('razisk') || txt.includes('research') || txt.includes('interest')) {
          const items = []
          let el = h.nextElementSibling
          while (el && !['H2', 'H3', 'H4'].includes(el.tagName)) {
            if (el.tagName === 'UL' || el.tagName === 'OL') {
              items.push(...[...el.querySelectorAll('li')].map(li => li.textContent.trim()).filter(Boolean))
            } else {
              const t = el.textContent.trim()
              if (t) items.push(t)
            }
            el = el.nextElementSibling
          }
          if (items.length) { podrocja = items.join(' · ').slice(0, 600); break }
        }
      }

      return { opis, podrocja }
    })
  } catch {
    return { opis: null, podrocja: null }
  }
}

// ── Glavni program ────────────────────────────────────────────────────────────

async function main() {
  console.log('Nalagam seznam profilov...')
  const { default: puppeteer } = await import('puppeteer-core')

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await makePage(browser)
  const profili = await pridobi_profile_url(page)
  console.log(`Najdenih ${profili.length} profilov\n`)

  let posodobljenih = 0

  for (const prof of profili) {
    const { opis, podrocja } = await scrapiProfil(page, prof.url)

    const kratkoIme = prof.ime.replace(/\b(prof\.|dr\.|mag\.|asist\.|doc\.|red\.|izr\.)\b/gi, '').trim()
    const parts = kratkoIme.split(/\s+/).filter(Boolean)
    if (parts.length < 2) continue
    const priimek = parts[parts.length - 1]
    const ime = parts.slice(0, -1).join(' ')

    console.log(`${ime} ${priimek}`)
    if (opis)     console.log(`  opis: ${opis.slice(0, 80)}`)
    if (podrocja) console.log(`  področja: ${podrocja.slice(0, 80)}...`)
    if (!opis && !podrocja) console.log(`  (ni podatkov)`)

    if (!DRY) {
      await pool.query(`
        UPDATE osebe SET
          opis       = COALESCE($1, opis),
          podrocja   = COALESCE($2, podrocja),
          profil_url = COALESCE($3, profil_url)
        WHERE LOWER(ime) = LOWER($4) AND LOWER(priimek) = LOWER($5)
      `, [opis, podrocja, prof.url || null, ime, priimek])
      posodobljenih++
    }
  }

  await browser.close()
  console.log(`\nPosodobljenih: ${posodobljenih}`)
  if (!DRY) await pool.end()
  else pool.end()
}

main().catch(e => { console.error('Napaka:', e.message); process.exit(1) })
