require('dotenv').config({ path: '.env.test' })
const OpenAI = require('openai')
const { Pool } = require('pg')
const axios = require('axios')
const cheerio = require('cheerio')

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_TEST,
  ssl: { rejectUnauthorized: false }
})

// RSS viri slovenskih medijev - gospodarska sekcija
// Google News RSS — avtomatsko najde relevantne slovenske članke
const BASE = 'https://news.google.com/rss/search?hl=sl&gl=SI&ceid=SI:sl&q='
const RSS_VIRI = [
  { url: BASE + 'direktor+podjetje+slovenija',   ime: 'Google News: direktorji' },
  { url: BASE + 'predsednik+uprave+slovenija',   ime: 'Google News: uprave' },
  { url: BASE + 'lastnik+podjetje+slovenija',    ime: 'Google News: lastniki' },
  { url: BASE + 'imenovanje+direktorja',         ime: 'Google News: imenovanja' },
  { url: 'https://www.delo.si/rss/',             ime: 'Delo' },
]

// Ključne besede — članek mora vsebovati vsaj eno
const KLJUCNE_BESEDE = [
  'direktor', 'direktorica', 'predsednik uprave', 'predsednica uprave',
  'nadzorni svet', 'lastnik', 'lastnica', 'solastnik', 'zastopnik',
  'imenovan', 'razrešen', 'uprava', 'd.d.', 'd.o.o.', 'podjetje',
  'banka', 'zavarovalnica', 'generalni direktor'
]

function jeRelevanten(naslov, opis) {
  const besedilo = (naslov + ' ' + opis).toLowerCase()
  return KLJUCNE_BESEDE.some(k => besedilo.includes(k))
}

async function potegniRSS(url) {
  const res = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
  })
  const $ = cheerio.load(res.data, { xmlMode: true })
  const clanki = []

  $('item').each((_, el) => {
    const naslov = $(el).find('title').text().trim()
    const link   = $(el).find('link').text().trim() || $(el).find('link').next().text().trim()
    const opis   = $(el).find('description').text().replace(/<[^>]*>/g, '').trim()

    if (link && jeRelevanten(naslov, opis)) {
      clanki.push({ naslov, link, opis })
    }
  })

  return clanki
}

async function potegniBesedilo(url) {
  const res = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
  })
  const $ = cheerio.load(res.data)
  $('nav, header, footer, script, style, aside, .ads, .cookie').remove()

  const selektorji = ['article', '.article-body', '.article__body', '.entry-content', 'main p', '.content p']
  let besedilo = ''
  for (const sel of selektorji) {
    const text = $(sel).text().trim()
    if (text.length > 200) { besedilo = text; break }
  }

  if (!besedilo) {
    besedilo = $('p').map((_, el) => $(el).text().trim()).get().join(' ')
  }

  return besedilo.substring(0, 3000).replace(/\s+/g, ' ').trim()
}

async function ekstrahirajPovezave(besedilo) {
  const prompt = `Iz naslednjega slovenskega besedila izvleci vse osebe in organizacije ter njihove vloge.

Vrni SAMO veljaven JSON (brez dodatnega besedila):
{
  "osebe": [{"ime": "Janez", "priimek": "Novak"}],
  "podjetja": [{"naziv": "Telekom Slovenije d.d."}],
  "povezave": [{"oseba_ime": "Janez", "oseba_priimek": "Novak", "podjetje": "Telekom Slovenije d.d.", "vloga": "direktor"}]
}

Pravila:
- Samo jasno omenjene vloge (direktor, predsednik, lastnik, član uprave...)
- Vloga max 3 besede
- Organizacije vključuj samo če imajo povezavo z osebo

Besedilo: ${besedilo}`

  const response = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  })

  const clean = response.choices[0].message.content.trim()
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean)
}

async function jeZeObdelan(url) {
  const res = await pool.query(
    `SELECT id FROM sync_log WHERE sporocilo = $1`, [url]
  )
  return res.rows.length > 0
}

async function shraniVBazo(podatki, vir) {
  let shranjenih = 0

  for (const podjetje of podatki.podjetja || []) {
    const kljuc = `AI-${podjetje.naziv.substring(0, 15).replace(/\s/g, '')}`
    await pool.query(
      `INSERT INTO podjetja (maticna, popolno_ime) VALUES ($1, $2)
       ON CONFLICT (maticna) DO UPDATE SET popolno_ime = EXCLUDED.popolno_ime`,
      [kljuc, podjetje.naziv]
    ).catch(() => {})
  }

  for (const oseba of podatki.osebe || []) {
    const obs = await pool.query(
      `SELECT id FROM osebe WHERE ime = $1 AND priimek = $2`,
      [oseba.ime, oseba.priimek]
    )
    if (obs.rows.length === 0) {
      await pool.query(
        `INSERT INTO osebe (ime, priimek) VALUES ($1, $2)`,
        [oseba.ime, oseba.priimek]
      ).catch(() => {})
    }
  }

  for (const p of podatki.povezave || []) {
    const o = await pool.query(`SELECT id FROM osebe WHERE ime=$1 AND priimek=$2`, [p.oseba_ime, p.oseba_priimek])
    const d = await pool.query(`SELECT id FROM podjetja WHERE popolno_ime=$1`, [p.podjetje])
    if (o.rows.length > 0 && d.rows.length > 0) {
      await pool.query(
        `INSERT INTO povezave (oseba_id, podjetje_id, vloga, vir) VALUES ($1,$2,$3,$4)`,
        [o.rows[0].id, d.rows[0].id, p.vloga, vir]
      ).catch(() => {})
      shranjenih++
    }
  }

  return shranjenih
}

async function glavnaFunkcija() {
  console.log('Avtomatski crawler slovenskih medijev\n')
  let skupajClankov = 0
  let skupajPovezav = 0

  for (const vir of RSS_VIRI) {
    console.log(`Berem RSS: ${vir.ime}...`)

    let clanki = []
    try {
      clanki = await potegniRSS(vir.url)
      console.log(`  Najdenih relevantnih člankov: ${clanki.length}`)
    } catch (err) {
      console.log(`  [!] RSS napaka: ${err.message}`)
      continue
    }

    for (const clanek of clanki.slice(0, 5)) { // max 5 na vir
      if (await jeZeObdelan(clanek.link)) {
        console.log(`  [→] Že obdelan: ${clanek.naslov.substring(0, 50)}`)
        continue
      }

      console.log(`  Obdelujem: ${clanek.naslov.substring(0, 60)}...`)

      try {
        // Najprej poskusi s celotnim člankom, drugače uporabi naslov+opis iz RSS
        let besedilo = ''
        try {
          besedilo = await potegniBesedilo(clanek.link)
        } catch (_) {}

        if (besedilo.length < 100) {
          besedilo = `${clanek.naslov}. ${clanek.opis}`
        }

        if (besedilo.length < 50) {
          console.log('    [!] Premalo besedila, preskočim')
          continue
        }

        const podatki = await ekstrahirajPovezave(besedilo)
        const shranjenih = await shraniVBazo(podatki, clanek.link)

        await pool.query(
          `INSERT INTO sync_log (vir, stevilo_zapisov, status, sporocilo) VALUES ($1, $2, 'uspeh', $3)`,
          [vir.ime, shranjenih, clanek.link]
        )

        console.log(`    ✓ ${podatki.osebe?.length || 0} oseb, ${podatki.povezave?.length || 0} povezav (shranjenih: ${shranjenih})`)
        skupajClankov++
        skupajPovezav += shranjenih

        // Počakaj 1s da ne preobremeniš API-ja
        await new Promise(r => setTimeout(r, 1000))
      } catch (err) {
        console.log(`    [!] Napaka: ${err.message}`)
      }
    }
  }

  console.log(`\nKončano! Obdelanih ${skupajClankov} člankov, ${skupajPovezav} novih povezav.`)
  await pool.end()
}

glavnaFunkcija().catch(async (err) => {
  console.error('Kritična napaka:', err.message)
  await pool.end()
})
