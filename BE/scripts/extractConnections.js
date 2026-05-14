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

async function potegniBesedilo(url) {
  const res = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
  })

  const $ = cheerio.load(res.data)

  // Odstrani navigacijo, reklame, footer
  $('nav, header, footer, script, style, aside, .ads, .advertisement, .cookie').remove()

  // Poskusi potegniti glavno vsebino članka
  const selektorji = ['article', '.article-body', '.article__body', '.entry-content', 'main p', '.content p']
  let besedilo = ''

  for (const sel of selektorji) {
    const text = $(sel).text().trim()
    if (text.length > 200) {
      besedilo = text
      break
    }
  }

  // Fallback: vse paragrafe
  if (!besedilo) {
    besedilo = $('p').map((_, el) => $(el).text().trim()).get().join(' ')
  }

  // Omeji na 3000 znakov (dovolj za Llama)
  return besedilo.substring(0, 3000).replace(/\s+/g, ' ').trim()
}

async function ekstrahirajPovezave(besedilo) {
  const prompt = `Iz naslednjega slovenskega besedila izvleci vse osebe in organizacije ter njihove vloge/povezave.

Vrni SAMO veljaven JSON v tej obliki (brez dodatnega besedila):
{
  "osebe": [{"ime": "Janez", "priimek": "Novak"}],
  "podjetja": [{"naziv": "Telekom Slovenije d.d."}],
  "povezave": [{"oseba_ime": "Janez", "oseba_priimek": "Novak", "podjetje": "Telekom Slovenije d.d.", "vloga": "direktor"}]
}

Pravila:
- Vključi samo jasno omenjene vloge (direktor, predsednik, lastnik, minister, član uprave...)
- Vloga naj bo kratka (max 3 besede)
- Če oseba nima vloge v organizaciji, je ne vključi v povezave
- Podjetja in organizacije vključuj samo če imajo vsaj eno povezavo z osebo

Besedilo:
${besedilo}`

  const response = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  })

  const content = response.choices[0].message.content.trim()
  const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean)
}

async function shraniVBazo(podatki, vir) {
  let shranjenih = 0

  for (const podjetje of podatki.podjetja || []) {
    await pool.query(
      `INSERT INTO podjetja (maticna, popolno_ime) VALUES ($1, $2)
       ON CONFLICT (maticna) DO UPDATE SET popolno_ime = EXCLUDED.popolno_ime`,
      [`AI-${podjetje.naziv.substring(0, 15).replace(/\s/g, '')}`, podjetje.naziv]
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

  for (const povezava of podatki.povezave || []) {
    const osebaRes = await pool.query(
      `SELECT id FROM osebe WHERE ime = $1 AND priimek = $2`,
      [povezava.oseba_ime, povezava.oseba_priimek]
    )
    const podjetjeRes = await pool.query(
      `SELECT id FROM podjetja WHERE popolno_ime = $1`,
      [povezava.podjetje]
    )

    if (osebaRes.rows.length > 0 && podjetjeRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO povezave (oseba_id, podjetje_id, vloga, vir) VALUES ($1, $2, $3, $4)`,
        [osebaRes.rows[0].id, podjetjeRes.rows[0].id, povezava.vloga, vir]
      ).catch(() => {})
      shranjenih++
    }
  }

  return shranjenih
}

async function glavnaFunkcija() {
  const url = process.argv[2]

  if (url) {
    // Način: node scripts/extractConnections.js <URL>
    console.log(`Berem članek: ${url}\n`)
    const besedilo = await potegniBesedilo(url)
    console.log(`Potegnjeno besedilo (${besedilo.length} znakov):\n${besedilo.substring(0, 300)}...\n`)

    const podatki = await ekstrahirajPovezave(besedilo)
    console.log('Najdeno:', JSON.stringify(podatki, null, 2))

    const shranjenih = await shraniVBazo(podatki, url)
    console.log(`\nShranjenih v bazo: ${shranjenih} povezav`)
  } else {
    // Način: testna besedila
    console.log('Uporaba: node scripts/extractConnections.js <URL>\nPrimer: node scripts/extractConnections.js https://www.rtvslo.si/...\n')
    console.log('Ker ni URL-ja, preskočim.')
  }

  await pool.end()
}

glavnaFunkcija().catch(async (err) => {
  console.error('Napaka:', err.message)
  await pool.end()
})
