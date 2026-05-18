/**
 * Scrape kazensko ovadenih iz Google News RSS (slovenščina)
 * Vir: news.google.com RSS - naslovi iz SI medijev
 * Zaženi: node scripts/scrapeNews2Ovadeni.js [--dry-run]
 */
require('dotenv').config()
const https = require('https')
const { Pool } = require('pg')

const DRY = process.argv.includes('--dry-run')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.request({
      hostname: u.hostname, path: u.pathname + (u.search || ''),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': '*/*' }
    }, res => {
      if (res.statusCode >= 300 && res.headers.location) {
        const loc = res.headers.location
        return httpGet(loc.startsWith('http') ? loc : `https://${u.hostname}${loc}`).then(resolve).catch(reject)
      }
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }))
    }).on('error', reject).end()
  })
}

function parseRss(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRegex.exec(xml)) !== null) {
    const item = m[1]
    const title = item.match(/<title>([^<]+)<\/title>/)?.[1]?.trim()
    const link = item.match(/<link>([^<]+)<\/link>|<link\s+href="([^"]+)"/)?.[1]?.trim()
    const date = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]
    const source = item.match(/<source[^>]*>([^<]+)<\/source>/)?.[1]?.trim()

    if (title && title.length > 10) {
      items.push({
        naslov: decodeHtml(title),
        url: link || '',
        datum: date ? new Date(date).toISOString().slice(0, 10) : null,
        vir: source || extractSourceFromTitle(title)
      })
    }
  }
  return items
}

function decodeHtml(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function extractSourceFromTitle(title) {
  const m = title.match(/\s[-–]\s+([\w\d.]+)\s*$/)
  return m?.[1] || 'novice'
}

// Pokliči funkcije pred besedo (minister, župan...) iz zajetega niza
const ROLE_PREFIXES = new Set([
  'minister', 'župan', 'županja', 'direktor', 'direktorica', 'predsednik', 'predsednica',
  'poslanec', 'poslanka', 'funkcionar', 'funkcionarka', 'policist', 'policistka',
  'premier', 'premierka', 'sekretar', 'sekretarka', 'načelnik', 'vodja',
  'kirurg', 'trener', 'trenerica', 'nekdanji', 'nekdanja', 'bivši', 'bivša',
  'dolgoletni', 'slavni', 'kanadski', 'lanski', 'igralec', 'generalni',
  'podpredsednik', 'komisar', 'uradnik', 'župan', 'redar', 'veleposlanik',
])

function stripRolePrefixes(name) {
  const words = name.split(' ')
  while (words.length > 1 && ROLE_PREFIXES.has(words[0].toLowerCase())) {
    words.shift()
  }
  return words.join(' ')
}

// Osnovna normalizacija sklanjatvenih oblik → nominativ
function normalizeDeclension(word) {
  // Akuzativ ženskih imen: -o → -a (Janšo → Janša, Hvalo → Hvala)
  if (word.endsWith('o') && word.length > 3) {
    const base = word.slice(0, -1)
    if (!'aeiouAEIOU'.includes(base[base.length - 1])) return base + 'a'
  }
  // Genitiv moških imen: -a → '' (Janeza → Janez, Bojana → Bojan, Filipa → Filip)
  // Varni soglasniki: ne vključuje š, ž, j (ker se končnice -ša, -ža, -ja pojavljajo v nom.)
  const SAFE = new Set('nrvzdtbpslmkgčćfh'.split(''))
  if (word.endsWith('a') && word.length > 4) {
    const base = word.slice(0, -1)
    if (SAFE.has(base[base.length - 1])) return base
  }
  return word
}

function normalizeName(name) {
  return name.split(' ').map(w => WORD_CORRECTIONS[w] ?? normalizeDeclension(w)).join(' ')
}

// Preveri ali gre za pravo osebno ime (obe besedi z veliko začetnico)
const BAD_NAME_WORDS = new Set([
  'Trije', 'Dva', 'Dve', 'Zoper', 'Nova', 'Novi', 'Stari', 'Lanski',
  'Slavni', 'Slavna', 'Kanadski', 'Norveški', 'Jordanov', 'Sin', 'Brat',
  'Oče', 'Mati', 'Liga', 'NBA', 'NFL', 'Ekipa', 'Vodja', 'Nekdanji',
  'Bivši', 'Tisočakov', 'Preplačane', 'Portoroške', 'Prometni',
  'Prvi', 'Drugi', 'Tretji', 'Četrti', 'Peti', 'Slovenec', 'Slovenka',
])

// Popravki za nepravilne genitiv → nominativ (Klemen → Klemna)
const WORD_CORRECTIONS = { 'Klemn': 'Klemen', 'Klemna': 'Klemen' }

function isValidPersonName(name) {
  const words = name.split(' ')
  if (words.length < 2 || words.length > 3) return false
  // Vse besede morajo se začeti z dejansko veliko začetnico (ne /i false positive)
  for (const w of words) {
    if (!w || w[0] !== w[0].toUpperCase() || w[0] === w[0].toLowerCase()) return false
    if (w.length < 2) return false
    if (BAD_NAME_WORDS.has(w)) return false
    // Besede, ki se končajo na -evo, -ega, -emu → pridevnik, ne priimek
    if (w.endsWith('evo') || w.endsWith('ega') || w.endsWith('emu') || w.endsWith('oga')) return false
    // Celotne kratice niso ime (NBA, SDS, NSi)
    if (w === w.toUpperCase() && w.length > 2) return false
  }
  return true
}

function extractName(title) {
  const patterns = [
    // "Ime Priimek kazensko ovaden/prijavljen/aretiran/obsojen" (na začetku naslova)
    /^([A-ZŠŽČĆĐ][a-zšžčćđ]+(?:\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+){1,2})\s+(?:je\s+)?(?:kazensko\s+)?(?:ovaden|ovadena|prijavljen|aretiran|obsojen|obsojena|obtožen|obtožena)/,
    // "kazensko ovadili/ovaden Ime [Srednje] Priimek" (do 3 besede, brez opcijskega absorbiranja)
    /(?:kazensko\s+)?(?:ovadili|ovadila|ovaden)\s+([A-ZŠŽČĆĐ][a-zšžčćđ]+(?:\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+){1,2})/,
    // "ovadba zoper/proti Ime Priimek"
    /ovadba\s+(?:zoper|proti)\s+([A-ZŠŽČĆĐ][a-zšžčćđ]+(?:\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+){1,2})/,
    // "zoper Ime Priimek [vložili/kazensko/ovadba]" (strogo - brez /i)
    /(?:zoper|proti)\s+([A-ZŠŽČĆĐ][a-zšžčćđ]+\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+)(?:\s+(?:vložili|kazensko|ovadba|aretacij))/,
    // "minister/župan/... Ime Priimek kazensko" - vzame po vlogi
    /(?:minister|župan|direktor|predsednik|poslanec|funkcionar|policist|premier|županja|kirurg|trener)\s+([A-ZŠŽČĆĐ][a-zšžčćđ]+\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+)\s+kazensko/i,
    // "Ime Priimek aretiran/obsojen/obtožen" - BREZ /i da ujame samo prave velike začetnice
    /([A-ZŠŽČĆĐ][a-zšžčćđ]+\s+[A-ZŠŽČĆĐ][a-zšžčćđ-]+)\s+(?:aretiran|obsodili|obsojeni|obtožen|prijet|pridržan)/,
  ]

  for (const pat of patterns) {
    const m = title.match(pat)
    if (m?.[1]) {
      let name = m[1].trim()
      name = stripRolePrefixes(name)
      name = normalizeName(name)
      if (isValidPersonName(name)) return name
    }
  }
  return null
}

function extractStatus(title) {
  const tl = title.toLowerCase()
  if (tl.includes('obsojen') || tl.includes('obsodil') || tl.includes('obsodba')) return 'obsojen'
  if (tl.includes('obtožen') || tl.includes('obtožnica')) return 'obtožen'
  if (tl.includes('aretiran') || tl.includes('prijet') || tl.includes('pridržan')) return 'v postopku'
  if (tl.includes('ovadba zavrž') || tl.includes('ovadba zavrnjen')) return 'oproščen'
  return 'v postopku'
}

async function fetchGoogleNews(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=sl&gl=SI&ceid=SI:sl`
  const r = await httpGet(url)
  if (r.status !== 200) return []
  return parseRss(r.body)
}

async function main() {
  const queries = [
    'kazensko ovaden slovenija',
    'kazenska ovadba slovenija',
    'kazensko ovadili slovenija',
    'obsojen kaznivo dejanje slovenija',
    'zoper kaznivo dejanje obtožnica slovenija',
  ]

  const allItems = []
  const seen = new Set()

  const ORG_WORDS = new Set(['Policija', 'Vlada', 'Sodišče', 'Komisija', 'Tožilstvo', 'Slovenija', 'Republika', 'Državni', 'Ministrstvo'])

  for (const q of queries) {
    console.log(`Iščem: "${q}"...`)
    const items = await fetchGoogleNews(q)
    console.log(`  ${items.length} člankov`)
    for (const item of items) {
      const name = extractName(item.naslov)
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const words = name.split(' ')
      if (words.some(w => ORG_WORDS.has(w))) continue

      allItems.push({ ...item, name, status: extractStatus(item.naslov) })
      console.log(`  ✓ ${name} | "${item.naslov.slice(0, 70)}" [${item.vir}]`)
    }
  }

  console.log(`\n=== SKUPAJ: ${allItems.length} oseb ===`)

  if (!DRY && allItems.length > 0) {
    try { await pool.query(`ALTER TABLE ovadeni ADD CONSTRAINT ovadeni_vir_url_key UNIQUE (vir_url)`) } catch (_) {}

    let dodanih = 0
    for (const item of allItems) {
      const parts = item.name.split(' ')
      const priimek = parts[parts.length - 1]
      const ime = parts.slice(0, -1).join(' ')

      try {
        const existing = await pool.query(`SELECT id FROM osebe WHERE LOWER(ime)=LOWER($1) AND LOWER(priimek)=LOWER($2)`, [ime, priimek])
        await pool.query(`
          INSERT INTO ovadeni (ime, priimek, oseba_id, zadeva, sodisce, status, datum, vir, vir_url)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (vir_url) DO UPDATE SET zadeva=EXCLUDED.zadeva, status=EXCLUDED.status
        `, [ime, priimek, existing.rows[0]?.id || null,
          item.naslov.slice(0, 300), item.vir, item.status,
          item.datum, item.vir, item.url])
        dodanih++
      } catch (e) { console.log(`Napaka: ${ime} ${priimek}:`, e.message) }
    }
    console.log(`✓ Vstavljenih: ${dodanih}`)
  } else {
    console.log('(dry-run)')
    allItems.forEach(i => {
      const p = i.name.split(' ')
      console.log(` ${p.slice(0,-1).join(' ')} ${p[p.length-1]} [${i.status}] @ ${i.vir} | ${i.url?.slice(0, 60)}`)
    })
  }

  await pool.end()
}

main().catch(e => { console.error('Napaka:', e.message); process.exit(1) })
