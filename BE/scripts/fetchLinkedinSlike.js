require('dotenv').config()
const https = require('https')
const http = require('http')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

function fetchUrl(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'))
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'sl-SI,sl;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, redirects - 1).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function poisciLinkedinUrl(ime, priimek, podjetje) {
  const query = encodeURIComponent(`${ime} ${priimek} ${podjetje} linkedin`)
  const url = `https://html.duckduckgo.com/html/?q=${query}`

  try {
    const html = await fetchUrl(url)
    // Poišči linkedin.com/in/ URL v rezultatih
    const match = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/i)
    return match ? match[0].split('"')[0].split("'")[0] : null
  } catch {
    return null
  }
}

async function poisciSliko(linkedinUrl) {
  try {
    const html = await fetchUrl(linkedinUrl)
    // Poišči og:image meta tag
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
              || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (match && match[1] && !match[1].includes('static') && match[1].includes('media')) {
      return match[1]
    }
    return null
  } catch {
    return null
  }
}

async function main() {
  const osebe = await pool.query(`
    SELECT o.id, o.ime, o.priimek, d.popolno_ime AS podjetje
    FROM osebe o
    LEFT JOIN povezave p ON p.oseba_id = o.id
    LEFT JOIN podjetja d ON d.id = p.podjetje_id
    GROUP BY o.id, d.popolno_ime
    ORDER BY o.id
  `)

  console.log(`Iščem LinkedIn slike za ${osebe.rows.length} oseb...\n`)
  let najdenih = 0

  for (const o of osebe.rows) {
    const linkedinUrl = await poisciLinkedinUrl(o.ime, o.priimek, o.podjetje || '')
    if (!linkedinUrl) {
      console.log(`  – ${o.ime} ${o.priimek} (LinkedIn ni najden)`)
      await new Promise(r => setTimeout(r, 500))
      continue
    }

    const slika = await poisciSliko(linkedinUrl)
    if (slika) {
      await pool.query(`UPDATE osebe SET slika_url = $1 WHERE id = $2`, [slika, o.id])
      console.log(`  ✓ ${o.ime} ${o.priimek}`)
      najdenih++
    } else {
      console.log(`  – ${o.ime} ${o.priimek} (LinkedIn najden, ni slike)`)
    }

    await new Promise(r => setTimeout(r, 800))
  }

  console.log(`\nKončano: ${najdenih}/${osebe.rows.length} slik najdenih.`)
  await pool.end()
}

main().catch(async err => {
  console.error('Napaka:', err.message)
  await pool.end()
})
