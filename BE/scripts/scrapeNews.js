require('dotenv').config()
const axios = require('axios')
const cheerio = require('cheerio')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const GN = 'https://news.google.com/rss/search?hl=sl&gl=SI&ceid=SI:sl&q='
const RSS_VIRI = [
  { url: GN + 'predsednik+uprave+slovenija', ime: 'Google News' },
  { url: GN + 'direktor+podjetje+slovenija', ime: 'Google News' },
  { url: GN + 'generalni+direktor+slovenija', ime: 'Google News' },
  { url: GN + 'uprava+podjetje+slovenija', ime: 'Google News' },
  { url: 'https://www.delo.si/rss/', ime: 'Delo' },
  { url: 'https://www.24ur.com/rss.xml', ime: '24ur' },
]

async function potegniRSS(url) {
  const res = await axios.get(url, {
    timeout: 12000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PovezavaSi/1.0)' }
  })
  const $ = cheerio.load(res.data, { xmlMode: true })
  const items = []
  $('item').each((_, el) => {
    const naslov = $(el).find('title').text().trim()
    const link = $(el).find('link').text().trim() || $(el).find('link').next().text().trim()
    const opis = $(el).find('description').text().replace(/<[^>]*>/g, '').trim().substring(0, 400)
    const datum = $(el).find('pubDate').text().trim()
    if (naslov && link) items.push({ naslov, url: link, povzetek: opis, datum: datum ? new Date(datum) : new Date() })
  })
  return items
}

async function najdiOsebe(besedilo, osebe) {
  const ujemanja = []
  for (const o of osebe) {
    const ime = `${o.ime} ${o.priimek}`
    if (besedilo.toLowerCase().includes(ime.toLowerCase())) {
      ujemanja.push(o.id)
    }
  }
  return ujemanja
}

async function main() {
  const osebeRes = await pool.query('SELECT id, ime, priimek FROM osebe')
  const osebe = osebeRes.rows
  console.log(`Iščem omembe za ${osebe.length} oseb...\n`)

  let skupajClankov = 0
  let skupajPovezav = 0

  for (const vir of RSS_VIRI) {
    console.log(`RSS: ${vir.ime}...`)
    let items = []
    try {
      items = await potegniRSS(vir.url)
      console.log(`  Najdenih ${items.length} člankov`)
    } catch (e) {
      console.log(`  [!] Napaka: ${e.message}`)
      continue
    }

    for (const item of items) {
      const besedilo = `${item.naslov} ${item.povzetek}`
      const osebeIds = await najdiOsebe(besedilo, osebe)
      if (osebeIds.length === 0) continue

      try {
        const res = await pool.query(
          `INSERT INTO clanki (naslov, url, vir, datum, povzetek)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (url) DO UPDATE SET naslov = EXCLUDED.naslov
           RETURNING id`,
          [item.naslov, item.url, vir.ime, item.datum, item.povzetek]
        )
        const clanekId = res.rows[0].id
        for (const osebaId of osebeIds) {
          await pool.query(
            `INSERT INTO clanki_osebe (clanek_id, oseba_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [clanekId, osebaId]
          )
          skupajPovezav++
        }
        skupajClankov++
        console.log(`  ✓ [${vir.ime}] ${item.naslov.substring(0, 60)}... (${osebeIds.length} oseb)`)
      } catch (_) {}
    }
  }

  console.log(`\nKončano: ${skupajClankov} člankov z omembami, ${skupajPovezav} povezav oseba↔članek.`)
  await pool.end()
}

main().catch(async e => { console.error(e.message); await pool.end() })
