/**
 * Scrape KPK - ugotovitve o kršitvah integritete
 * Zaženi: node scripts/scrapeKpk.js [--dry-run]
 */
require('dotenv').config()
const https = require('https')
const { Pool } = require('pg')

const DRY = process.argv.includes('--dry-run')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const KPK_SITEMAP = 'https://www.kpk-rs.si/sitemap.xml'
const KPK_ODLOCBE = 'https://www.kpk-rs.si/sl/novice/pravnomocne-prekrskovne-odlocbe'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.request({ hostname: u.hostname, path: u.pathname + (u.search || ''),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*' }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }).on('error', reject).end()
  })
}

function normalizeDate(dateStr) {
  if (!dateStr) return null
  const slMatch = dateStr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/)
  if (slMatch) return `${slMatch[3]}-${slMatch[2].padStart(2, '0')}-${slMatch[1].padStart(2, '0')}`
  const d = new Date(dateStr)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

function parseViolationType(text) {
  const tl = text.toLowerCase()
  if (tl.includes('lobiranje') || tl.includes('lobiranja')) return 'lobiranje'
  if (tl.includes('nasprotje interesov') || tl.includes('nasprotja interesov')) return 'nasprotje interesov'
  if (tl.includes('integritete') || tl.includes('kršitvi')) return 'kršitev integritete'
  if (tl.includes('premoženjsko stanje')) return 'premoženjsko stanje'
  if (tl.includes('darilo') || tl.includes('daril')) return 'sprejemanje daril'
  return 'kpk ugotovitev'
}

// Stroge URL vzorce - le dejansko o kršitvah konkretnih oseb
const VIOLATION_URL_PATTERNS = [
  /sodisce-potrdilo-ugotovitve/,
  /visje-sodisce-potrdilo-krsitev/,
  /komisija-ugotovila-krsitev/,
  /krsitev-nasprotja-interesov-(?!obcinsk|mestne|poklicnih|uradnik)/,
  /nov-primer-krsitve/,
  /komisija-znova-potrdila/,
  /komisija-ugotovila-nov-primer/,
  /komisija-zakljucila.*krsitev/,
  /komisija-zaradi-ugotovljenih-krsitev/,
  /krsitev-dolocb/,
  /zakljucena-postopka-glede-sumov/,
]

// Besede ki potrjujejo da je ime v kontekstu kršitve
const VIOLATION_CONTEXT = ['ravnanjem', 'kršil', 'kršila', 'kršitvi', 'kršitev', 'odločbo', 'ugotovitve', 'zoper', 'postopku', 'obtožen', 'obsodil']

function extractNameFromText(text) {
  // Izvleci vse Ime Priimek kombinacije
  const candidates = [...text.matchAll(/(?:^|\s)([A-ZŠŽČĆĐ][a-zšžčćđ]{2,})\s+([A-ZŠŽČĆĐ][a-zšžčćđ-]{2,})(?:\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]{2,})?/g)]
    .map(m => m[0].trim())
    .filter(name => {
      // Filtriraj organizacije in generične besede
      const bad = ['Komisija Za', 'Višje Sodišče', 'Okrajno Sodišče', 'Upravno Sodišče',
        'Vrhovno Sodišče', 'Slovenian Press', 'Mestna Občina', 'Republika Slovenija',
        'Ministrstvo Za', 'Nova Univerza', 'Finančna Uprava', 'Državni Zbor',
        'Tako Okrajno', 'Sodišče V', 'Komisija V', 'Komisija Za']
      if (bad.some(b => name.toLowerCase().startsWith(b.toLowerCase()))) return false
      if (name.toLowerCase().includes('komisij')) return false
      if (name.toLowerCase().includes('sodišč')) return false
      if (name.toLowerCase().includes('ministrst')) return false
      if (name.toLowerCase().includes('upravn')) return false
      return true
    })

  // Poišči kandidate v kontekstu kršitve
  for (const candidate of candidates) {
    const idx = text.indexOf(candidate)
    if (idx < 0) continue
    const ctx = text.slice(Math.max(0, idx - 60), idx + candidate.length + 60).toLowerCase()
    if (VIOLATION_CONTEXT.some(kw => ctx.includes(kw))) {
      return candidate
    }
  }

  // Vzorec "ravnanjem [Name]"
  const ravnMatch = text.match(/ravnanjem\s+(?:dr\.|mag\.\s+)?([A-ZŠŽČĆĐ][a-zšžčćđ]+\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+)/)
  if (ravnMatch) return ravnMatch[1]

  // Vzorec "z ravnanjem [nekdanjega ...] [Name]"
  const nekdanjMatch = text.match(/(?:nekdanjega?|bivšega?)\s+(?:[a-zšžčćđA-ZŠŽČĆĐ\s]+?)\s+([A-ZŠŽČĆĐ][a-zšžčćđ]+\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+)/)
  if (nekdanjMatch && nekdanjMatch[1].split(' ').length <= 3) return nekdanjMatch[1]

  return null
}

// Pretvori rodilnik v nominativ
function rodilnikVNominativ(name) {
  const parts = name.split(' ')
  return parts.map(word => {
    if (word.endsWith('lja') && word.length > 4) return word.slice(0, -3) + 'elj'
    if (word.endsWith('čka') && word.length > 4) return word.slice(0, -3) + 'ček'
    if (word.match(/[bcdfghjklmnprstvz]a$/) && word.length > 4) return word.slice(0, -1)
    if (word.endsWith('ka') && word.length > 4) return word.slice(0, -1) // Čerjaka → Čerjak
    return word
  }).join(' ')
}

async function main() {
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  const osebe = []
  const seen = new Set()

  // === VIR 1: KPK odločbe stran (Livewire) - zanesljivi podatki ===
  console.log('=== VIR 1: KPK odločbe Livewire ===')
  await page.goto(KPK_ODLOCBE, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  const odlocbeItems = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/novice/"]')]
      .map(a => ({ naslov: a.textContent.trim(), url: a.href }))
      .filter(i => i.naslov.includes(':') && i.naslov.toLowerCase().includes('odločit'))
  )

  for (const item of odlocbeItems) {
    const nameRaw = item.naslov.split(':').pop().trim()
    if (nameRaw.length < 4) continue
    const key = nameRaw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const parts = nameRaw.split(' ').filter(Boolean)
    if (parts.length < 2) continue
    osebe.push({ ime: parts.slice(0, -1).join(' '), priimek: parts[parts.length - 1],
      zadeva: parseViolationType(item.naslov) + ' — ' + item.naslov,
      datum: null, vir_url: item.url })
    console.log(` ✓ ${nameRaw}`)
  }

  // === VIR 2: KPK sitemap - samo URL-ji z dejanskimi kršitvami ===
  console.log('\n=== VIR 2: KPK sitemap (filtrirani URL-ji) ===')
  const sitemapHtml = await httpGet(KPK_SITEMAP)
  const allNewsUrls = [...sitemapHtml.matchAll(/<loc>(https:\/\/www\.kpk-rs\.si\/sl\/novice\/[^<]+)<\/loc>/g)].map(m => m[1])

  const violationUrls = allNewsUrls.filter(url => {
    const slug = url.split('/').pop()
    const exclude = ['usposab', 'posvet', 'nacrt-integritete', 'krepitev-integritete', 'ambasador',
      'mladi-', 'dijak', 'studenti', 'z-znanjem', 'conference', 'kongres', 'seminar',
      'predavanj', 'delavnic', 'dobrodelnost', 'razpis', 'fakultet', 'univerz']
    if (exclude.some(e => slug.includes(e))) return false
    return VIOLATION_URL_PATTERNS.some(p => p.test(slug))
  })

  console.log(`Filtrirani URL-ji: ${violationUrls.length}`)

  let processed = 0
  for (const url of violationUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
      await new Promise(r => setTimeout(r, 1500))

      const data = await page.evaluate(() => {
        const paragraphs = [...document.querySelectorAll('main p')]
          .map(p => p.textContent.trim()).filter(t => t.length > 30).slice(0, 5).join(' ')
        const time = document.querySelector('time, .date')
        return { text: paragraphs, datum: time?.textContent?.trim() || time?.getAttribute('datetime') }
      })

      if (!data.text || data.text.length < 50) { processed++; continue }

      const nameRaw = extractNameFromText(data.text)
      if (!nameRaw) { processed++; continue }

      const nameFixed = rodilnikVNominativ(nameRaw)
      const parts = nameFixed.split(' ').filter(Boolean)
      if (parts.length < 2 || parts.length > 4) { processed++; continue }

      // Dodatna validacija - mora biti pravo ime (ne organizacija)
      const isBad = ['Okrajno', 'Višje', 'Osnov', 'Mestna', 'Občina', 'Občine', 'Občini', 'Republika', 'Finančn', 'Ministrst', 'Komisij', 'Institut', 'Javni', 'JGZ', 'Tako', 'Zavod', 'Agencij', 'Solkan', 'Sama '].some(b => nameFixed.includes(b))
      if (isBad) { processed++; continue }

      const key = nameFixed.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        const slug = url.split('/').pop()
        osebe.push({ ime: parts.slice(0, -1).join(' '), priimek: parts[parts.length - 1],
          zadeva: parseViolationType(slug + ' ' + data.text.slice(0, 200)) + ' — ' + nameFixed,
          datum: data.datum || null, vir_url: url })
        console.log(` ✓ ${nameFixed} [${parseViolationType(slug)}]`)
      }
    } catch (_) {}
    processed++
    process.stdout.write(`\r  ${processed}/${violationUrls.length} `)
  }

  await browser.close()

  console.log(`\n\n=== SKUPAJ: ${osebe.length} oseb ===`)
  osebe.forEach(o => console.log(` ${o.ime} ${o.priimek} | ${o.zadeva.slice(0, 80)}`))

  if (!DRY && osebe.length > 0) {
    try { await pool.query(`ALTER TABLE ovadeni ADD CONSTRAINT ovadeni_vir_url_key UNIQUE (vir_url)`) } catch (_) {}
    let dodanih = 0
    for (const o of osebe) {
      try {
        const existing = await pool.query(`SELECT id FROM osebe WHERE LOWER(ime)=LOWER($1) AND LOWER(priimek)=LOWER($2)`, [o.ime, o.priimek])
        await pool.query(`
          INSERT INTO ovadeni (ime, priimek, oseba_id, zadeva, sodisce, status, datum, vir, vir_url)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (vir_url) DO UPDATE SET zadeva=EXCLUDED.zadeva, oseba_id=EXCLUDED.oseba_id
        `, [o.ime, o.priimek, existing.rows[0]?.id || null, o.zadeva, 'KPK', 'ugotovljena kršitev', normalizeDate(o.datum), 'KPK', o.vir_url])
        dodanih++
      } catch (e) { console.log(`Napaka: ${o.ime} ${o.priimek}:`, e.message) }
    }
    console.log(`\n✓ Vstavljenih: ${dodanih}`)
  } else console.log('\n(dry-run)')

  await pool.end()
}

main().catch(e => { console.error('Napaka:', e.message); process.exit(1) })
