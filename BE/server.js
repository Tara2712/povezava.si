require('dotenv').config()
// v2.4 — Gemini + Google Search grounding, Groq fallback
const express = require('express')
const { Pool } = require('pg')
const axios = require('axios')
const OpenAI = require('openai')
const podjetjaRoutes = require('./routes/podjetja')
const osebeRoutes = require('./routes/osebe')
const omrezjeRoutes = require('./routes/omrezje')
const povezaveRoutes = require('./routes/povezave')
const searchRoutes = require('./routes/search')
const statsRoutes = require('./routes/stats')
const lobistiRoutes = require('./routes/lobisti')
const ovadeniRoutes = require('./routes/ovadeni')
const bfsRoutes = require('./test6Degrees/bfs_nova')
const geminiRoutes = require('./routes/gemini_ai')
const kordinateRoutes = require('./routes/kordinate')


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

bfsRoutes.setupRoutes(app)

/* const bfs = require('./test6Degrees/bfs')
bfs.nalogajGraf() 
bfs.setupRoutes(app) */

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
app.use('/kordinate', kordinateRoutes)
geminiRoutes.setupRoutes(app)

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

// GET /osebe/primerjaj?a=ID1&b=ID2
app.get('/osebe/primerjaj', async (req, res) => {
  try {
    const { a, b } = req.query
    if (!a || !b) return res.status(400).json({ error: 'Manjkata parametra a in b' })

    const [osebaA, osebaB, skupna] = await Promise.all([
      pool.query(`
        SELECT o.id, o.ime, o.priimek, o.fotografija_url, o.institucija, o.tip,
          COUNT(p.id) AS stevilo_povezav
        FROM osebe o LEFT JOIN povezave p ON p.oseba_id = o.id
        WHERE o.id = $1 GROUP BY o.id
      `, [a]),
      pool.query(`
        SELECT o.id, o.ime, o.priimek, o.fotografija_url, o.institucija, o.tip,
          COUNT(p.id) AS stevilo_povezav
        FROM osebe o LEFT JOIN povezave p ON p.oseba_id = o.id
        WHERE o.id = $1 GROUP BY o.id
      `, [b]),
      pool.query(`
        SELECT d.id, d.popolno_ime, d.pravna_oblika,
          pa.vloga AS vloga_a, pa.datum_od AS od_a, pa.datum_do AS do_a,
          pb.vloga AS vloga_b, pb.datum_od AS od_b, pb.datum_do AS do_b
        FROM podjetja d
        JOIN povezave pa ON pa.podjetje_id = d.id AND pa.oseba_id = $1
        JOIN povezave pb ON pb.podjetje_id = d.id AND pb.oseba_id = $2
        ORDER BY d.popolno_ime
      `, [a, b])
    ])

    if (!osebaA.rows[0]) return res.status(404).json({ error: 'Oseba A ni najdena' })
    if (!osebaB.rows[0]) return res.status(404).json({ error: 'Oseba B ni najdena' })

    res.json({ oseba_a: osebaA.rows[0], oseba_b: osebaB.rows[0], skupna_podjetja: skupna.rows })
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

// POST /ai/vprasaj — AI asistent (Gemini + Google Search, Groq fallback)
// ── Helpers for the AI endpoint ──────────────────────────────────────────────

const NAME_STOP = new Set([
  // question/function words
  'kdo','je','kaj','so','v','na','in','ali','da','se','mi','za','iz','bi','pa','ne','to','ta','po','od','do',
  'pri','ko','kar','kje','kdaj','kako','zakaj','koga','koliko','katere','kateri','bila','bil','bil','sem',
  'smo','ste','sta','si','me','te','ga','jo','nas','vas','jih','mu','ji','jim','tem','tej','teh','temu',
  // verbs
  'ima','nima','imajo','nimajo','dela','deluje','delajo','zivi','zivijo','vodi','vodijo','je','so','bo',
  'bodo','bom','bos','bomo','boste','bosta','imam','imas','imamo','imate','imata',
  // adjectives/adverbs
  'največ','najmanj','malo','veliko','bolj','manj','najbolj','najbol','top','prvih','prv','samo','tudi',
  'takoj','zdaj','tam','tu','takrat','potem','ker','torej','zato','ampak','toda','zelo','precej',
  // nouns that are not names
  'mrez','omrez','mreza','mreze','omrezje','pove','povezave','povezav','baza','bazah','bazi',
  'podatki','podatkov','informacij','rezultati','odgovor','vprasanje','akademik','profesor',
  'poslovnez','oseba','osebo','osebi','podjetje','podjetja','podjetij',
  // profil request words
  'povezavo','profil','link','prosim','lahko','daj','poišči','pokaži','odpri','poglej','najdi','posreduj',
  // role words
  'direktor','vodja','predsednik','zaposleni','uprava','ravnatelj','minister','lastnik'
])

function extractName(text) {
  if (!text) return null
  const cap = text.match(/[A-ZŠŽČĆĐ][a-zšžčćđ]+ [A-ZŠŽČĆĐ][a-zšžčćđ]+/)
  if (cap) return cap[0]
  const words = (text.toLowerCase().match(/[a-zšžčćđ]+/g) || []).filter(w => w.length > 2 && !NAME_STOP.has(w))
  return words.length >= 2 ? `${words[0]} ${words[1]}` : null
}

function isFollowUp(text) {
  return /\b(on|ona|njega|njemu|njem|njegov|njegova|njegovo|njegovi|njena|njeni|njeno|ji|mu|ga|njej|nje|njo)\b/i.test(text)
}

async function lookupPersonInDB(nameStr, pool) {
  const parts = nameStr.trim().split(/\s+/)
  if (parts.length < 2) return null
  try {
    const norm = (s) => s.toLowerCase().replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd')
    const p1 = parts[0], p2 = parts[1]
    const n1 = norm(p1), n2 = norm(p2)
    const r = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.tip, o.opis, o.institucija, o.profil_url,
        JSON_AGG(JSON_BUILD_OBJECT('podjetje', d.popolno_ime, 'vloga', p.vloga))
          FILTER (WHERE d.id IS NOT NULL) AS povezave
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      LEFT JOIN podjetja d ON d.id = p.podjetje_id
      WHERE (o.ime ILIKE $1 AND o.priimek ILIKE $2) OR (o.ime ILIKE $2 AND o.priimek ILIKE $1)
         OR (translate(LOWER(o.ime),'čćšžđ','ccszd') ILIKE $3 AND translate(LOWER(o.priimek),'čćšžđ','ccszd') ILIKE $4)
         OR (translate(LOWER(o.ime),'čćšžđ','ccszd') ILIKE $4 AND translate(LOWER(o.priimek),'čćšžđ','ccszd') ILIKE $3)
      GROUP BY o.id LIMIT 3
    `, [`%${p1}%`, `%${p2}%`, `%${n1}%`, `%${n2}%`])
    if (!r.rows.length) return null
    const o = r.rows[0]
    const connections = (o.povezave || []).slice(0, 8).map(p => `${p.podjetje} (${p.vloga})`).join(', ') || '/'
    let profilExtra = ''
    if (o.tip === 'akademik' && o.profil_url) {
      const scraped = await fetchProfilData(o.profil_url)
      if (scraped) profilExtra = `\n\nSpletni profil (${o.profil_url}):\n${scraped.slice(0, 1500)}`
    }
    return {
      osebe: r.rows,
      summary: `**${o.ime} ${o.priimek}** — ${o.tip}, ${o.institucija || ''}\nOpis: ${o.opis || '/'}\nPovezave (${o.povezave?.length || 0}): ${connections}${profilExtra}`
    }
  } catch { return null }
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolLookupPerson(name) {
  const result = await lookupPersonInDB(name, pool)
  if (!result) return { found: false, message: `Oseba "${name}" ni v bazi Povezava.si.`, osebe: null }
  return { found: true, osebe: result.osebe, message: result.summary }
}

async function toolGetStats() {
  const r = await pool.query(`SELECT (SELECT COUNT(*) FROM osebe) AS osebe,(SELECT COUNT(*) FROM podjetja) AS podjetja,(SELECT COUNT(*) FROM povezave) AS povezave`)
  const s = r.rows[0]
  return `V bazi je ${s.osebe} oseb, ${s.podjetja} podjetij in ${s.povezave} poslovnih povezav.`
}

async function toolGetCompanyStaff(company) {
  const stem = company.length > 4 ? company.replace(/[aeiouAEIOU]$/, '') : company
  const r = await pool.query(`
    SELECT o.id, o.ime, o.priimek, p.vloga, d.popolno_ime AS podjetje
    FROM osebe o JOIN povezave p ON p.oseba_id=o.id JOIN podjetja d ON d.id=p.podjetje_id
    WHERE d.popolno_ime ILIKE $1 OR d.popolno_ime ILIKE $2
    ORDER BY p.vloga LIMIT 12
  `, [`%${company}%`, `%${stem}%`])
  if (!r.rows.length) return `Podjetje "${company}" ni najdeno v bazi.`
  return `${r.rows[0].podjetje}: ${r.rows.map(o => `${o.ime} ${o.priimek} (${o.vloga})`).join(', ')}`
}

async function toolGetTopConnected(limit = 5) {
  const n = parseInt(limit) || 5
  const r = await pool.query(`SELECT o.id,o.ime,o.priimek,COUNT(p.id) AS n FROM osebe o JOIN povezave p ON p.oseba_id=o.id GROUP BY o.id ORDER BY n DESC LIMIT $1`, [n])
  return r.rows.map((o, i) => `${i + 1}. ${o.ime} ${o.priimek} — ${o.n} povezav`).join('\n')
}

async function toolGetLobists() {
  const r = await pool.query(`SELECT COUNT(*) AS n FROM lobisti_info WHERE aktiven = true`)
  return `V registru je ${r.rows[0].n} aktivnih lobistov.`
}

async function toolSearchAkademiki() {
  const r = await pool.query(`SELECT id, ime, priimek, opis, institucija FROM osebe WHERE tip = 'akademik' ORDER BY priimek LIMIT 10`)
  return r.rows.map(o => `${o.ime} ${o.priimek} — ${o.institucija || o.opis || ''}`).join('\n')
}

const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup_person',
      description: 'Poišči osebo v bazi Povezava.si po imenu in priimku. Uporabi za VSA vprašanja o specifični osebi (kdo je, kje dela, profil, projekti, itd.).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Ime in priimek, npr. "Marjan Heričko" ali "Domen Verber"' } },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_database_stats',
      description: 'Pridobi statistike baze: koliko oseb, podjetij in poslovnih povezav je v Povezava.si.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_company_staff',
      description: 'Poišči osebe ki delajo ali so delali v določenem podjetju ali organizaciji. Uporabi za "kdo je direktor X", "kdo dela v X", "uprava X".',
      parameters: {
        type: 'object',
        properties: { company: { type: 'string', description: 'Ime podjetja, npr. "Petrol", "NLB", "Telekom"' } },
        required: ['company']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_top_connected',
      description: 'Pridobi seznam oseb z največ poslovnimi povezavami v bazi.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'string', description: 'Koliko rezultatov (privzeto 5), npr. "5" ali "10"' } }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_lobists',
      description: 'Pridobi informacije o lobistih v registru.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_akademiki',
      description: 'Pridobi seznam akademikov (profesorjev) iz baze, zlasti z UM FERI.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Poišči informacije na spletu. Uporabi SAMO ko oseba ni v bazi ali ko vprašanje zahteva aktualne/spletne informacije.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Iskalni niz za spletno iskanje' } },
        required: ['query']
      }
    }
  }
]

// ── Main AI endpoint ──────────────────────────────────────────────────────────

app.post('/ai/vprasaj', async (req, res) => {
  const { vprasanje, history } = req.body
  if (!vprasanje?.trim()) return res.status(400).json({ error: 'Manjka vprašanje' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  const emit = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  try {
    const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })

    const SYSTEM = `Si profesionalni AI asistent za Povezava.si — slovensko spletno bazo poslovnih in akademskih mrež v Sloveniji. Baza vsebuje osebe (akademike, podjetnike, lobiste), podjetja in poslovne povezave med njimi.

PRAVILA:
- Odgovarjaj VEDNO v slovenščini.
- Ko orodje vrne podatke, jih VEDNO navedi v odgovoru — ne izpusti nobenih imen ali številk.
- Ko orodje vrne seznam oseb, prikaži celoten seznam s formatiranim izpisom.
- Ko orodje vrne "ni v bazi", sporoči to jasno in ne izmišljaj podatkov.
- Sledi kontekstu pogovora — ko se tema zamenja, upoštevaj NOVO temo.
- Ko te IZRECNO prosijo za profil ali za link do profila osebe (npr. "pokaži profil", "pošlji link"), odgovori "Profil je prikazan spodaj." Za splošna vprašanja o osebi (npr. "Kdo je X?", "Kaj dela X?") pa prikaži informacije iz orodja.
- Podatki iz orodij so EDINI vir resnice za bazo. Ne dodajaj imen, ki jih orodje ni vrnilo.
- Za vprašanja o tem, kaj je Povezava.si: je slovenska podatkovna baza poslovnih in akademskih mrež, ki zbira informacije o osebah in podjetjih ter njihovih medsebojnih povezavah.`

    const messages = [
      { role: 'system', content: SYSTEM },
      ...(history || []).slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: (m.text || '').slice(0, 600)
      })).filter(m => m.content),
      { role: 'user', content: vprasanje }
    ]

    // Step 1: Let LLM decide which tool(s) to call
    const toolResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools: AI_TOOLS,
      tool_choice: 'auto',
      max_tokens: 300,
      temperature: 0.1
    })

    const assistantMsg = toolResponse.choices[0].message
    let profil = null

    // Step 2: Execute tool calls
    if (assistantMsg.tool_calls?.length) {
      messages.push(assistantMsg)

      for (const call of assistantMsg.tool_calls) {
        let args = {}
        try { args = JSON.parse(call.function.arguments) || {} } catch {}

        let result = ''
        if (call.function.name === 'lookup_person') {
          const r = await toolLookupPerson(args.name)
          if (r.found) { profil = r.osebe[0] }
          result = r.message
        }
        else if (call.function.name === 'get_database_stats') result = await toolGetStats()
        else if (call.function.name === 'get_company_staff') result = await toolGetCompanyStaff(args.company)
        else if (call.function.name === 'get_top_connected') result = await toolGetTopConnected(args.limit)
        else if (call.function.name === 'get_lobists') result = await toolGetLobists()
        else if (call.function.name === 'get_akademiki') result = await toolSearchAkademiki()
        else if (call.function.name === 'search_web') result = await searchWeb(args.query) || 'Ni rezultatov.'

        messages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }

    // Emit profile link metadata
    emit({ meta: { podatki: { profil } } })

    // Step 3: Stream final answer
    emit({ vir: 'groq' })
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 600,
      temperature: 0.3,
      stream: true
    })

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) emit({ chunk: text })
    }
    emit({ done: true })
    res.end()
  } catch (err) {
    console.error('AI napaka:', err.message, '\n', err.stack?.split('\n').slice(0, 4).join('\n'))
    emit({ vir: 'sistem' })
    emit({ chunk: 'Napaka pri procesiranju. Prosim poskusite znova.' })
    emit({ done: true })
    res.end()
  }
})

async function searchWeb(query) {
  if (!process.env.TAVILY_API_KEY) return null
  try {
    const resp = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: query + ' Slovenija',
      search_depth: 'basic',
      max_results: 4,
      include_answer: true
    }, { timeout: 8000 })
    const answer = resp.data.answer || ''
    const snippets = (resp.data.results || [])
      .map(r => `[${r.title}]: ${r.content?.slice(0, 300)}`)
      .join('\n')
    return [answer, snippets].filter(Boolean).join('\n\n').slice(0, 2000)
  } catch (e) {
    console.warn('Tavily napaka:', e.message)
    return null
  }
}

async function fetchProfilData(url) {
  if (!url) return null
  try {
    const resp = await axios.get(url, { timeout: 7000, headers: { 'User-Agent': 'Mozilla/5.0' } })
    const text = resp.data
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<li>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
      .trim()

    const projIdx = text.search(/Mednarodni projekti/i)
    if (projIdx >= 0) {
      const endIdx = text.search(/(?:Bibliografija|Kontakt|Nagrade|Povezave|Izobraževanje)/i)
      const end = endIdx > projIdx ? Math.min(endIdx, projIdx + 3000) : projIdx + 3000
      return text.slice(projIdx, end).trim()
    }
    return text.slice(500, 2500)
  } catch (e) {
    console.warn('Scraping napaka:', e.message)
    return null
  }
}

async function gatherContext(q, pool, history = []) {
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

  let nameMatch = q.match(/[A-ZŠŽČĆĐ][a-zšžčćđ]+ [A-ZŠŽČĆĐ][a-zšžčćđ]+/)

  // Also detect lowercase names (e.g. "kdo je luka pavlič", "povezavo na profil domen verber")
  if (!nameMatch) {
    const STOP = new Set([
      'kdo','je','kaj','so','v','na','in','ali','da','se','mi','za','iz','bi','pa','ne','to','ta','po','od','do',
      'pri','ko','kar','kje','kdaj','kako','zakaj','koga','katere','kateri','koliko','katero','bila','bil','ima',
      'povezavo','profil','link','oseba','osebo','osebi','poisci','pokazi','odpri','poglej','najdi','posreduj',
      'prosim','zdaj','lahko','daj','pošlji','poišči','pokaži','njegova','njeni','njegovi',
      'direktor','vodja','predsednik','zaposleni','uprava','ravnatelj','minister','lastnik'
    ])
    const words = (q.toLowerCase().match(/[a-zšžčćđ]+/g) || []).filter(w => w.length > 2 && !STOP.has(w))
    if (words.length >= 2) nameMatch = [`${words[0]} ${words[1]}`]
  }

  // For follow-up questions: search USER messages first (most reliable), then AI messages
  if (!nameMatch && history.length) {
    const userMsgs = history.filter(m => m.role === 'user').reverse()
    const aiMsgs = history.filter(m => m.role !== 'user').reverse()
    for (const msg of [...userMsgs, ...aiMsgs]) {
      const m = (msg.text || '').match(/[A-ZŠŽČĆĐ][a-zšžčćđ]+ [A-ZŠŽČĆĐ][a-zšžčćđ]+/)
      if (m) { nameMatch = m; break }
    }
  }
  if (nameMatch) {
    const parts = nameMatch[0].split(' ')
    const r = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.tip, o.opis, o.institucija, o.profil_url,
        JSON_AGG(JSON_BUILD_OBJECT('podjetje', d.popolno_ime, 'vloga', p.vloga, 'podjetje_id', d.id))
          FILTER (WHERE d.id IS NOT NULL) AS povezave
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      LEFT JOIN podjetja d ON d.id = p.podjetje_id
      WHERE (o.ime ILIKE $1 AND o.priimek ILIKE $2) OR (o.ime ILIKE $2 AND o.priimek ILIKE $1)
      GROUP BY o.id LIMIT 3
    `, [`%${parts[0]}%`, `%${parts[1]}%`])

    if (r.rows.length) {
      const o = r.rows[0]
      const pov = o.povezave?.slice(0, 5).map(p => p.podjetje).join(', ') || 'ni podatkov'
      let profilInfo = ''
      if (o.tip === 'akademik' && o.profil_url) {
        const scraped = await fetchProfilData(o.profil_url)
        if (scraped) profilInfo = `\n\nPodatki s spletnega profila (${o.profil_url}):\n${scraped}`
      }
      return {
        podatki: { tip: 'oseba', osebe: r.rows },
        fallbackOdgovor: `${o.ime} ${o.priimek} je ${o.tip === 'akademik' ? 'akademik' : 'poslovnež'} s ${o.povezave?.length || 0} poslovnimi povezavami. Povezan z: ${pov}.${profilInfo}`
      }
    }
  }

  // Iskanje po podjetju — "direktor Petrola", "kdo vodi X", "zaposleni v X"
  const podjetjeMatch = ql.match(/(?:direktor|vodja|uprava|zaposleni|dela v|vodi|predsednik)\s+(?:\w+\s+){0,2}(\w{3,})|(\w{4,})(?:'s| d\.o\.o\.| d\.d\.| s\.p\.| a\.s\.)?/i)
  const podjetjeWord = q.match(/[A-ZŠŽČĆĐ][a-zšžčćđA-ZŠŽČĆĐ]{2,}(?:\s+[A-ZŠŽČĆĐ][a-zšžčćđ]+)?/)
  if ((ql.includes('direktor') || ql.includes('vodi') || ql.includes('uprava') || ql.includes('predsednik') || ql.includes('zaposleni')) && podjetjeWord) {
    const ime = podjetjeWord[0]
    // Also try stem (remove Slovenian genitive ending -a/-e/-u)
    const imeStem = ime.length > 4 ? ime.replace(/[aeiouAEIOUaeiou]$/u, '') : ime
    const r = await pool.query(`
      SELECT o.id, o.ime, o.priimek, p.vloga, d.popolno_ime AS podjetje
      FROM osebe o
      JOIN povezave p ON p.oseba_id = o.id
      JOIN podjetja d ON d.id = p.podjetje_id
      WHERE d.popolno_ime ILIKE $1 OR d.kratko_ime ILIKE $1 OR d.popolno_ime ILIKE $2 OR d.kratko_ime ILIKE $2
      ORDER BY p.vloga ASC LIMIT 10
    `, [`%${ime}%`, `%${imeStem}%`])
    if (r.rows.length) {
      const podjetjeIme = r.rows[0].podjetje
      const osebe = r.rows.map(o => `${o.ime} ${o.priimek} (${o.vloga})`).join(', ')
      return {
        podatki: { tip: 'oseba', osebe: r.rows.map(o => ({ id: o.id, ime: o.ime, priimek: o.priimek })) },
        fallbackOdgovor: `V podjetju ${podjetjeIme} so v bazi evidentirani: ${osebe}.`
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

    const osebe = await pool.query(`
      SELECT o.id, o.ime, o.priimek, 'oseba' AS tip,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      WHERE LOWER(o.ime || ' ' || o.priimek) LIKE LOWER($1)
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