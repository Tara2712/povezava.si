const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const https = require('https')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.request({
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'sl-SI,sl;q=0.9',
      }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject).end()
  })
}

function parseSodnapraksa(html) {
  const results = []
  const tableStart = html.indexOf('<table id="results-table">')
  if (tableStart < 0) return { results, strani: 0 }
  const tableEnd = html.indexOf('</table>', tableStart)
  const tableHtml = html.slice(tableStart, tableEnd)

  // Ugotovi skupno število strani iz paginacije
  const pageNums = [...html.matchAll(/page=(\d+)/g)].map(m => parseInt(m[1]))
  const maxPage = pageNums.length ? Math.max(...pageNums) : 0
  const strani = maxPage + 1

  const rowRegex = /<tr[^>]*class="(?:even|odd)"[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const row = rowMatch[1]
    const cells = []
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1]
        .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '').trim()
      )
    }
    const hrefMatch = row.match(/href="([^"]+id=[^"]+)"/)
    const docIdMatch = hrefMatch?.[1].match(/id=([a-zA-Z0-9]+)/)
    if (cells.length >= 5) {
      results.push({
        dokument: cells[1] || '',
        sodisce: cells[2] || '',
        oddelek: cells[3] || '',
        datum: cells[4] || null,
        institut: cells[5] || '',
        jedro: cells[6] || '',
        vir_url: docIdMatch ? `https://www.sodnapraksa.si/?id=${docIdMatch[1]}` : null,
      })
    }
  }
  return { results, strani }
}

// GET /ovadeni/sodnapraksa?q=&page=0 — live iskanje po sodnapraksa.si
router.get('/sodnapraksa', async (req, res) => {
  const q = req.query.q?.trim() || ''
  const page = Math.max(0, parseInt(req.query.page) || 0)
  if (!q) return res.json({ results: [], strani: 0 })

  try {
    const url = `https://www.sodnapraksa.si/?q=${encodeURIComponent(q)}&database%5BSOVS%5D=SOVS&database%5BIESP%5D=IESP&database%5BVDSS%5D=VDSS&database%5BUPRS%5D=UPRS&rowsPerPage=20&page=${page}&_submit=I%C5%A1%C4%8Di`
    const html = await fetchUrl(url)
    const parsed = parseSodnapraksa(html)
    res.json(parsed)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /ovadeni?q=&limit=&offset=&status=
router.get('/', async (req, res) => {
  try {
    const q = req.query.q?.trim() || ''
    const status = req.query.status?.trim() || ''
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0
    const params = []
    const conditions = []

    if (q) {
      params.push(`%${q}%`)
      conditions.push(`(LOWER(ime || ' ' || priimek) LIKE LOWER($${params.length})
                     OR LOWER(COALESCE(zadeva,'')) LIKE LOWER($${params.length})
                     OR LOWER(COALESCE(sodisce,'')) LIKE LOWER($${params.length}))`)
    }
    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    params.push(limit, offset)

    const result = await pool.query(`
      SELECT id, ime, priimek, oseba_id, zadeva, opis, datum,
        sodisce, status, vir, vir_url
      FROM ovadeni
      ${where}
      ORDER BY datum DESC NULLS LAST, priimek, ime
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ovadeni ${where}`,
      params.slice(0, -2)
    )

    res.json({ skupaj: parseInt(countResult.rows[0].count), ovadeni: result.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /ovadeni/:id
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM ovadeni WHERE id = $1`, [req.params.id])
    if (!r.rows.length) return res.status(404).json({ error: 'Vnos ni najden' })
    res.json(r.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
