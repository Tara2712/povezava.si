require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')
const axios = require('axios')
const podjetjaRoutes = require('./routes/podjetja')
const osebeRoutes = require('./routes/osebe')
const omrezjeRoutes = require('./routes/omrezje')
const povezaveRoutes = require('./routes/povezave')
const searchRoutes = require('./routes/search')
const statsRoutes = require('./routes/stats')
const lobistiRoutes = require('./routes/lobisti')
const ovadeniRoutes = require('./routes/ovadeni')

const app = express()
const PORT = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  next()
})

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Povezava.si backend deluje!' })
})

app.use('/api/podjetja', podjetjaRoutes)
app.use('/api/osebe', osebeRoutes)
app.use('/api/omrezje', omrezjeRoutes)
app.use('/api/povezave', povezaveRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/stats', statsRoutes)
app.use('/stats', statsRoutes)
app.use('/api/lobisti', lobistiRoutes)
app.use('/lobisti', lobistiRoutes)
app.use('/api/ovadeni', ovadeniRoutes)
app.use('/ovadeni', ovadeniRoutes)

// GET /osebe — seznam oseb (limit, tip opcijski)
app.get('/osebe', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null
    const tip   = ['poslovnez', 'akademik'].includes(req.query.tip) ? req.query.tip : null

    const params = []
    let where = ''
    if (tip) { params.push(tip); where = `WHERE o.tip = $${params.length}` }
    if (limit) params.push(limit)

    const result = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.tip, o.fotografija_url, o.institucija, o.naziv,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      ${where}
      GROUP BY o.id
      ORDER BY stevilo_povezav DESC
      ${limit ? `LIMIT $${params.length}` : ''}
    `, params)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /akademiki — seznam akademikov za domačo stran
app.get('/akademiki', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5
    const result = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.naziv, o.institucija, o.fotografija_url,
        o.opis, o.podrocja, o.profil_url,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      WHERE o.tip = 'akademik'
      GROUP BY o.id
      ORDER BY
        CASE
          WHEN o.opis ILIKE '%Predstojnik inštituta%' THEN 1
          WHEN o.opis ILIKE '%Namestnik predstojnika%' THEN 2
          WHEN o.opis ILIKE '%Redni profesor%' THEN 3
          WHEN o.opis ILIKE '%Izredni profesor%' THEN 4
          WHEN o.opis ILIKE '%Docent%' THEN 5
          WHEN o.opis ILIKE '%Višji predavatelj%' OR o.opis ILIKE '%Predavatelj%' THEN 6
          WHEN o.opis ILIKE '%Asistent%' THEN 7
          WHEN o.opis ILIKE '%Mladi raziskovalec%' THEN 8
          WHEN o.opis ILIKE '%Tehnični sodelavec%' THEN 9
          WHEN o.fotografija_url IS NOT NULL THEN 10
          ELSE 11
        END,
        o.priimek
      LIMIT $1
    `, [limit])
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /osebe/:id — profil osebe z njenimi povezavami
app.get('/osebe/:id', async (req, res) => {
  try {
    const { id } = req.params

    const oseba = await pool.query(`SELECT * FROM osebe WHERE id = $1`, [id])
    if (oseba.rows.length === 0) return res.status(404).json({ error: 'Oseba ni najdena' })

    const povezave = await pool.query(`
      SELECT p.vloga, p.datum_od, p.datum_do,
        d.id AS podjetje_id, d.popolno_ime, d.pravna_oblika
      FROM povezave p
      JOIN podjetja d ON d.id = p.podjetje_id
      WHERE p.oseba_id = $1
      ORDER BY p.vloga
    `, [id])

    res.json({ ...oseba.rows[0], povezave: povezave.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /podjetja — seznam podjetij (limit opcijski)
app.get('/podjetja', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50
    const result = await pool.query(`
      SELECT d.id, d.maticna, d.popolno_ime, d.pravna_oblika, d.posta,
        COUNT(p.id) AS stevilo_povezav
      FROM podjetja d
      LEFT JOIN povezave p ON p.podjetje_id = d.id
      GROUP BY d.id
      ORDER BY stevilo_povezav DESC
      LIMIT $1
    `, [limit])
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /podjetja/:id — profil podjetja z osebami
app.get('/podjetja/:id', async (req, res) => {
  try {
    const { id } = req.params

    const podjetje = await pool.query(`SELECT * FROM podjetja WHERE id = $1`, [id])
    if (podjetje.rows.length === 0) return res.status(404).json({ error: 'Podjetje ni najdeno' })

    const osebe = await pool.query(`
      SELECT p.vloga, p.vir, p.datum_od, p.datum_do,
        o.id AS oseba_id, o.ime, o.priimek
      FROM povezave p
      JOIN osebe o ON o.id = p.oseba_id
      WHERE p.podjetje_id = $1
      ORDER BY p.vloga
    `, [id])

    res.json({ ...podjetje.rows[0], osebe: osebe.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /povezave — vse povezave
app.get('/povezave', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.vloga,
        o.ime, o.priimek,
        d.popolno_ime AS podjetje
      FROM povezave p
      JOIN osebe o ON o.id = p.oseba_id
      JOIN podjetja d ON d.id = p.podjetje_id
      ORDER BY p.id DESC
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /omrezje/:id — BFS do 6 stopenj ločenosti
app.get('/omrezje/:id', async (req, res) => {
  const { id } = req.params
  const maxDepth = Math.min(parseInt(req.query.depth) || 3, 6)
  const maxNodes = 80

  try {
    const startResult = await pool.query(`SELECT id, ime, priimek FROM osebe WHERE id = $1`, [id])
    if (startResult.rows.length === 0) return res.status(404).json({ error: 'Oseba ni najdena' })

    const sp = startResult.rows[0]
    const nodes = new Map()
    const edges = []

    nodes.set(`o-${id}`, { key: `o-${id}`, id: parseInt(id), type: 'oseba', name: `${sp.ime} ${sp.priimek}`, depth: 0, isCenter: true })

    let frontierOsebe = [parseInt(id)]
    let frontierPodjetja = []
    const visitedO = new Set([parseInt(id)])
    const visitedP = new Set()

    for (let d = 0; d < maxDepth && nodes.size < maxNodes; d++) {
      if (d % 2 === 0) {
        // oseba → podjetja
        if (!frontierOsebe.length) break
        const r = await pool.query(`
          SELECT p.oseba_id, p.podjetje_id, d.popolno_ime, p.vloga
          FROM povezave p JOIN podjetja d ON d.id = p.podjetje_id
          WHERE p.oseba_id = ANY($1)
        `, [frontierOsebe])

        const next = []
        for (const row of r.rows) {
          if (nodes.size >= maxNodes) break
          const key = `d-${row.podjetje_id}`
          if (!nodes.has(key)) nodes.set(key, { key, id: row.podjetje_id, type: 'podjetje', name: row.popolno_ime, depth: d + 1 })
          const eKey = `${`o-${row.oseba_id}`}__${key}`
          if (!edges.find(e => e.key === eKey)) edges.push({ key: eKey, from: `o-${row.oseba_id}`, to: key, vloga: row.vloga })
          if (!visitedP.has(row.podjetje_id)) { visitedP.add(row.podjetje_id); next.push(row.podjetje_id) }
        }
        frontierPodjetja = next
      } else {
        // podjetja → osebe
        if (!frontierPodjetja.length) break
        const r = await pool.query(`
          SELECT p.podjetje_id, p.oseba_id, o.ime, o.priimek, p.vloga
          FROM povezave p JOIN osebe o ON o.id = p.oseba_id
          WHERE p.podjetje_id = ANY($1)
        `, [frontierPodjetja])

        const next = []
        for (const row of r.rows) {
          if (nodes.size >= maxNodes) break
          const key = `o-${row.oseba_id}`
          if (!nodes.has(key)) nodes.set(key, { key, id: row.oseba_id, type: 'oseba', name: `${row.ime} ${row.priimek}`, depth: d + 1 })
          const eKey = `d-${row.podjetje_id}__${key}`
          if (!edges.find(e => e.key === eKey)) edges.push({ key: eKey, from: `d-${row.podjetje_id}`, to: key, vloga: row.vloga })
          if (!visitedO.has(row.oseba_id)) { visitedO.add(row.oseba_id); next.push(row.oseba_id) }
        }
        frontierOsebe = next
      }
    }

    res.json({
      center: { id: parseInt(id), name: `${sp.ime} ${sp.priimek}` },
      nodes: [...nodes.values()],
      edges: edges.map(({ key, ...e }) => e),
      maxDepth
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /clanki?limit=&offset=&q= — članki z iskanjem
app.get('/clanki', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 8, 100)
    const offset = parseInt(req.query.offset) || 0
    const q      = req.query.q?.trim() || ''

    const params = []
    let where = ''
    if (q) {
      params.push(`%${q}%`)
      where = `WHERE (LOWER(c.naslov) LIKE LOWER($1) OR LOWER(COALESCE(c.povzetek,'')) LIKE LOWER($1)
                OR EXISTS (
                  SELECT 1 FROM clanki_osebe co2
                  JOIN osebe o2 ON o2.id = co2.oseba_id
                  WHERE co2.clanek_id = c.id
                  AND LOWER(o2.ime || ' ' || o2.priimek) LIKE LOWER($1)
                ))`
    }
    params.push(limit, offset)

    const result = await pool.query(`
      SELECT c.id, c.naslov, c.url, c.vir, c.datum, c.povzetek,
        JSON_AGG(JSON_BUILD_OBJECT('id', o.id, 'ime', o.ime, 'priimek', o.priimek))
          FILTER (WHERE o.id IS NOT NULL) AS osebe
      FROM clanki c
      LEFT JOIN clanki_osebe co ON co.clanek_id = c.id
      LEFT JOIN osebe o ON o.id = co.oseba_id
      ${where}
      GROUP BY c.id
      ORDER BY c.datum DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM clanki c ${where}`,
      params.slice(0, -2)
    )

    res.json({ skupaj: parseInt(countRes.rows[0].count), clanki: result.rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /osebe/:id/clanki — članki kjer se pojavi ta oseba
app.get('/osebe/:id/clanki', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.naslov, c.url, c.vir, c.datum
      FROM clanki c
      JOIN clanki_osebe co ON co.clanek_id = c.id
      WHERE co.oseba_id = $1
      ORDER BY c.datum DESC
      LIMIT 10
    `, [req.params.id])
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /scrape — sproži scraping novic (za GitHub Actions cron)
app.post('/scrape', async (req, res) => {
  const secret = process.env.SCRAPE_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  res.json({ status: 'started' })
  const { execFile } = require('child_process')
  execFile('node', ['scripts/scrapeNews.js'], { cwd: __dirname }, (err) => {
    if (err) console.error('Scrape napaka:', err.message)
    else console.log('Scrape končan.')
  })
})

// GET /pot?od=:id&do=:id — BFS najkrajša pot med dvema osebama
app.get('/pot', async (req, res) => {
  const fromId = parseInt(req.query.od)
  const toId   = parseInt(req.query.do)
  if (!fromId || !toId) return res.status(400).json({ error: 'Manjkata parametra od in do' })

  try {
    const [startRes, endRes] = await Promise.all([
      pool.query('SELECT id, ime, priimek FROM osebe WHERE id = $1', [fromId]),
      pool.query('SELECT id, ime, priimek FROM osebe WHERE id = $1', [toId])
    ])
    if (!startRes.rows.length) return res.status(404).json({ error: 'Začetna oseba ni najdena' })
    if (!endRes.rows.length)   return res.status(404).json({ error: 'Končna oseba ni najdena' })

    const sp = startRes.rows[0]
    const ep = endRes.rows[0]

    if (fromId === toId) return res.json({
      path: [{ type: 'oseba', id: fromId, name: `${sp.ime} ${sp.priimek}` }], stopnje: 0
    })

    const visitedO = new Map()
    const visitedP = new Map()
    visitedO.set(fromId, [{ type: 'oseba', id: fromId, name: `${sp.ime} ${sp.priimek}` }])

    let frontierOsebe    = [fromId]
    let frontierPodjetja = []

    for (let depth = 0; depth < 12; depth++) {
      if (depth % 2 === 0) {
        if (!frontierOsebe.length) break
        const r = await pool.query(`
          SELECT p.oseba_id, p.podjetje_id, d.popolno_ime, p.vloga
          FROM povezave p JOIN podjetja d ON d.id = p.podjetje_id
          WHERE p.oseba_id = ANY($1::int[])
        `, [frontierOsebe])

        const next = []
        for (const row of r.rows) {
          if (visitedP.has(row.podjetje_id)) continue
          const newPath = [...visitedO.get(row.oseba_id),
            { type: 'podjetje', id: row.podjetje_id, name: row.popolno_ime, vloga: row.vloga }]
          visitedP.set(row.podjetje_id, newPath)
          next.push(row.podjetje_id)
        }
        frontierPodjetja = next
      } else {
        if (!frontierPodjetja.length) break
        const r = await pool.query(`
          SELECT p.podjetje_id, p.oseba_id, o.ime, o.priimek, p.vloga
          FROM povezave p JOIN osebe o ON o.id = p.oseba_id
          WHERE p.podjetje_id = ANY($1::int[])
        `, [frontierPodjetja])

        const next = []
        for (const row of r.rows) {
          if (visitedO.has(row.oseba_id)) continue
          const newPath = [...visitedP.get(row.podjetje_id),
            { type: 'oseba', id: row.oseba_id, name: `${row.ime} ${row.priimek}`, vloga: row.vloga }]

          if (row.oseba_id === toId) {
            return res.json({ path: newPath, stopnje: Math.floor((newPath.length - 1) / 2) })
          }
          visitedO.set(row.oseba_id, newPath)
          next.push(row.oseba_id)
        }
        frontierOsebe = next
      }
    }

    res.json({ path: null, stopnje: null,
      sporocilo: `Pot med ${sp.ime} ${sp.priimek} in ${ep.ime} ${ep.priimek} ni bila najdena v 6 stopnjah ločenosti.` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /ai/vprasaj — AI asistent (Ollama + rule-based fallback)
app.post('/ai/vprasaj', async (req, res) => {
  const { vprasanje } = req.body
  if (!vprasanje?.trim()) return res.status(400).json({ error: 'Manjka vprašanje' })

  try {
    const context = await gatherContext(vprasanje, pool)

    let ollamaOdgovor = null
    const ollamaUrl   = process.env.OLLAMA_URL || 'http://localhost:11434'
    const ollamaModel = process.env.OLLAMA_MODEL || 'mistral'
    try {
      const resp = await axios.post(`${ollamaUrl}/api/generate`, {
        model: ollamaModel,
        prompt: `Si asistent za Povezava.si, slovensko bazo poslovnih in akademskih mrež.\n\nPodatki iz baze:\n${JSON.stringify(context.podatki)}\n\nSistematski odgovor: "${context.fallbackOdgovor}"\n\nUporabnikovo vprašanje: "${vprasanje}"\n\nOdgovori v slovenščini, kratko (1-3 stavke). Ne ponovi besede za besedo — razširi ali izboljšaj odgovor.`,
        stream: false
      }, { timeout: 12000 })
      ollamaOdgovor = resp.data?.response?.trim() || null
    } catch (_) {}

    res.json({
      odgovor: ollamaOdgovor || context.fallbackOdgovor,
      podatki: context.podatki,
      vir: ollamaOdgovor ? 'ollama' : 'sistem'
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function gatherContext(q, pool) {
  const ql = q.toLowerCase()

  if (ql.includes('koliko') || ql.includes('statistik') || ql.includes('baza') || ql.includes('bazi')) {
    const r = await pool.query(`
      SELECT (SELECT COUNT(*) FROM osebe) AS osebe,
             (SELECT COUNT(*) FROM podjetja) AS podjetja,
             (SELECT COUNT(*) FROM povezave) AS povezave`)
    const s = r.rows[0]
    return {
      podatki: { tip: 'stats', osebe: +s.osebe, podjetja: +s.podjetja, povezave: +s.povezave },
      fallbackOdgovor: `V bazi je ${s.osebe} oseb, ${s.podjetja} podjetij in ${s.povezave} poznanih poslovnih povezav.`
    }
  }

  const nameMatch = q.match(/[A-ZŠŽČĆĐ][a-zšžčćđ]+ [A-ZŠŽČĆĐ][a-zšžčćđ]+/)
  if (nameMatch) {
    const parts = nameMatch[0].split(' ')
    const r = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.tip, o.opis, o.institucija,
        JSON_AGG(JSON_BUILD_OBJECT('podjetje', d.popolno_ime, 'vloga', p.vloga, 'podjetje_id', d.id))
          FILTER (WHERE d.id IS NOT NULL) AS povezave
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      LEFT JOIN podjetja d ON d.id = p.podjetje_id
      WHERE LOWER(o.ime) LIKE LOWER($1) OR LOWER(o.priimek) LIKE LOWER($2)
      GROUP BY o.id LIMIT 3
    `, [`%${parts[0]}%`, `%${parts[1]}%`])

    if (r.rows.length) {
      const o = r.rows[0]
      const pov = o.povezave?.slice(0, 3).map(p => p.podjetje).join(', ') || 'ni podatkov'
      return {
        podatki: { tip: 'oseba', osebe: r.rows },
        fallbackOdgovor: `${o.ime} ${o.priimek} je ${o.tip === 'akademik' ? 'akademik' : 'poslovnež'} s ${o.povezave?.length || 0} poslovnimi povezavami. Povezan z: ${pov}.`
      }
    }
  }

  if (ql.includes('akademik') || ql.includes('profesor') || ql.includes('feri') || ql.includes('univerz')) {
    const r = await pool.query(`SELECT id, ime, priimek, opis FROM osebe WHERE tip = 'akademik' LIMIT 5`)
    return {
      podatki: { tip: 'akademiki', osebe: r.rows },
      fallbackOdgovor: `V bazi je ${r.rows.length}+ akademikov UM FERI Inštituta za informatiko. Nekateri: ${r.rows.map(o => `${o.ime} ${o.priimek}`).join(', ')}.`
    }
  }

  if (ql.includes('lobist')) {
    const r = await pool.query(`SELECT COUNT(*) AS n FROM lobisti_info WHERE aktiven = true`)
    return {
      podatki: { tip: 'lobisti', stevilo: +r.rows[0].n },
      fallbackOdgovor: `V registru lobistov je ${r.rows[0].n} aktivnih lobistov.`
    }
  }

  if (ql.includes('pove') || ql.includes('mrež') || ql.includes('povekan')) {
    const r = await pool.query(`
      SELECT o.id, o.ime, o.priimek, COUNT(p.id) AS n
      FROM osebe o JOIN povezave p ON p.oseba_id = o.id
      GROUP BY o.id ORDER BY n DESC LIMIT 3`)
    const top = r.rows.map(o => `${o.ime} ${o.priimek} (${o.n})`).join(', ')
    return {
      podatki: { tip: 'top_osebe', osebe: r.rows },
      fallbackOdgovor: `Najbolj povezane osebe v bazi so: ${top}.`
    }
  }

  const stats = await pool.query(`
    SELECT (SELECT COUNT(*) FROM osebe) AS osebe, (SELECT COUNT(*) FROM podjetja) AS podjetja`)
  const s = stats.rows[0]
  return {
    podatki: { tip: 'splosno' },
    fallbackOdgovor: `Povezava.si je baza poslovnih mrež s ${s.osebe} osebami in ${s.podjetja} podjetji. Vprašaj me o konkretni osebi, podjetju ali poslovnih mrežah.`
  }
}

// GET /search?q=janez&tip=poslovnez|akademik — iskanje oseb in podjetij
app.get('/search', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`
    const tip = ['poslovnez', 'akademik'].includes(req.query.tip) ? req.query.tip : null

    const tipWhere = tip ? `AND o.tip = '${tip}'` : ''

    const osebe = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.tip, o.fotografija_url, 'oseba' AS vrsta,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      WHERE LOWER(o.ime || ' ' || o.priimek) LIKE LOWER($1) ${tipWhere}
      GROUP BY o.id
      LIMIT 10
    `, [q])

    const podjetja = await pool.query(`
      SELECT d.id, d.popolno_ime AS naziv, 'podjetje' AS tip,
        COUNT(p.id) AS stevilo_povezav
      FROM podjetja d
      LEFT JOIN povezave p ON p.podjetje_id = d.id
      WHERE LOWER(d.popolno_ime) LIKE LOWER($1)
      GROUP BY d.id
      LIMIT 10
    `, [q])

    res.json([...osebe.rows, ...podjetja.rows])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server teče na portu ${PORT}`)
})

module.exports = app