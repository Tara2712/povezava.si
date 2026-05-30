require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function fetchProfilData(url) {
  if (!url) return null
  try {
    const resp = await axios.get(url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } })
    let html = resp.data
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<h[1-6][^>]*>/gi, '\n### ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/li>/gi, '')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|section|article|td|tr)[^>]*>/gi, '\n')
      .replace(/<a[^>]*href="mailto:([^"]+)"[^>]*>/gi, (_, email) => email + ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    const PROFILE_SECTIONS = /Kontakt|Izobrazba|Zaposlitev|Področja|Projekti|Mednarodni|Bibliografija|Nagrade|Mentorstvo/i
    const startIdx = html.search(PROFILE_SECTIONS)
    if (startIdx > 50) html = html.slice(startIdx)

    return html.slice(0, 3500).trim()
  } catch (e) {
    return null
  }
}

async function main() {
  const r = await pool.query(`
    SELECT id, ime, priimek, profil_url FROM osebe
    WHERE profil_url LIKE 'https://ii.feri.um.si%'
    ORDER BY priimek
  `)

  console.log(`Najdenih ${r.rows.length} akademikov z FERI profil URL-jem\n`)

  let ok = 0, fail = 0
  for (const o of r.rows) {
    process.stdout.write(`${o.ime} ${o.priimek}... `)
    const data = await fetchProfilData(o.profil_url)
    if (data && data.length > 100) {
      await pool.query('UPDATE osebe SET feri_profil_text = $1 WHERE id = $2', [data, o.id])
      console.log(`OK (${data.length} znakov)`)
      ok++
    } else {
      console.log('NAPAKA ali prazno')
      fail++
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone: ${ok} shranjenih, ${fail} napak`)
  await pool.end()
}

main().catch(e => { console.error(e); pool.end() })
