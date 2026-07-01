const express = require('express')
const { Pool } = require('pg')

const defaultPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

function createRouter(dbPool = defaultPool) {
  const router = express.Router()

  // GET /osebe — seznam z filtri
  router.get('/', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200)
      const offset = parseInt(req.query.offset) || 0
      const tip = req.query.tip
      const q = req.query.q
      const minPov = req.query.min_povezave ? parseInt(req.query.min_povezave) : null
      const maxPov = req.query.max_povezave ? parseInt(req.query.max_povezave) : null
      const samo_lobisti = req.query.lobisti === '1'
      const samo_ovadeni = req.query.ovadeni === '1'
      const sort = req.query.sort || 'povezave'

      const params = []
      const where = []
      let joins = ''

      if (tip) { params.push(tip); where.push(`o.tip = $${params.length}`) }
      if (q) { params.push(`%${q}%`); where.push(`(LOWER(o.ime || ' ' || o.priimek) LIKE LOWER($${params.length}) OR LOWER(COALESCE(o.institucija,'')) LIKE LOWER($${params.length}))`) }
      if (samo_lobisti) joins += ' JOIN lobisti lb ON lb.oseba_id = o.id'
      if (samo_ovadeni) joins += ' JOIN ovadeni ov ON ov.oseba_id = o.id'

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const having = []
      if (minPov !== null) { params.push(minPov); having.push(`COUNT(p.id) >= $${params.length}`) }
      if (maxPov !== null) { params.push(maxPov); having.push(`COUNT(p.id) <= $${params.length}`) }
      const havingClause = having.length ? `HAVING ${having.join(' AND ')}` : ''

      const orderBy =
        sort === 'az' ? 'o.priimek ASC, o.ime ASC' :
        sort === 'za' ? 'o.priimek DESC, o.ime DESC' :
        'stevilo_povezav DESC'

      const baseParams = [...params]
      params.push(limit, offset)

      const [result, countResult] = await Promise.all([
        dbPool.query(`
          SELECT o.id, o.ime, o.priimek, o.tip, o.fotografija_url, o.institucija, o.naziv,
            COUNT(p.id) AS stevilo_povezav
          FROM osebe o
          LEFT JOIN povezave p ON p.oseba_id = o.id
          ${joins}
          ${whereClause}
          GROUP BY o.id
          ${havingClause}
          ORDER BY ${orderBy}
          LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params),
        dbPool.query(`
          SELECT COUNT(*) FROM (
            SELECT o.id
            FROM osebe o
            LEFT JOIN povezave p ON p.oseba_id = o.id
            ${joins}
            ${whereClause}
            GROUP BY o.id
            ${havingClause}
          ) sub
        `, baseParams)
      ])

      res.json({ skupaj: parseInt(countResult.rows[0].count), osebe: result.rows })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // GET /osebe/primerjaj?a=ID1&b=ID2
  router.get('/primerjaj', async (req, res) => {
    try {
      const { a, b } = req.query
      if (!a || !b) return res.status(400).json({ error: 'Manjkata parametra a in b' })

      const [osebaA, osebaB, skupna] = await Promise.all([
        dbPool.query(`
          SELECT o.id, o.ime, o.priimek, o.fotografija_url, o.institucija, o.tip,
            COUNT(p.id) AS stevilo_povezav
          FROM osebe o LEFT JOIN povezave p ON p.oseba_id = o.id
          WHERE o.id = $1 GROUP BY o.id
        `, [a]),
        dbPool.query(`
          SELECT o.id, o.ime, o.priimek, o.fotografija_url, o.institucija, o.tip,
            COUNT(p.id) AS stevilo_povezav
          FROM osebe o LEFT JOIN povezave p ON p.oseba_id = o.id
          WHERE o.id = $1 GROUP BY o.id
        `, [b]),
        dbPool.query(`
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

      res.json({
        oseba_a: osebaA.rows[0],
        oseba_b: osebaB.rows[0],
        skupna_podjetja: skupna.rows
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // GET /osebe/:id/tveganje — indikatorji tveganja za osebo (must be before GET /:id)
  router.get('/:id/tveganje', async (req, res) => {
    try {
      const osebaId = parseInt(req.params.id)
      if (!osebaId) return res.status(400).json({ error: 'Neveljaven ID osebe' })

      const osebaRes = await dbPool.query(`SELECT id, ime, priimek FROM osebe WHERE id = $1`, [osebaId])
      if (!osebaRes.rows.length) return res.status(404).json({ error: 'Oseba ni najdena' })

      const [funkcijeRes, aktivneFunkcijeRes, lobistRes, skupnaTveganaRes] = await Promise.all([
        dbPool.query(`SELECT COUNT(*)::int AS n FROM povezave WHERE oseba_id = $1`, [osebaId]),
        dbPool.query(`SELECT COUNT(*)::int AS n FROM povezave WHERE oseba_id = $1 AND datum_do IS NULL`, [osebaId]),
        dbPool.query(`SELECT COUNT(*)::int AS n FROM lobisti_info WHERE oseba_id = $1 AND datum_izpisa IS NULL`, [osebaId]),
        dbPool.query(`
          WITH moja_podjetja AS (
            SELECT DISTINCT podjetje_id FROM povezave WHERE oseba_id = $1
          ),
          tvegane_osebe AS (
            SELECT DISTINCT oseba_id FROM lobisti_info WHERE datum_izpisa IS NULL
          )
          SELECT COUNT(DISTINCT p.podjetje_id)::int AS n
          FROM povezave p
          JOIN moja_podjetja mp ON mp.podjetje_id = p.podjetje_id
          JOIN tvegane_osebe t ON t.oseba_id = p.oseba_id
          WHERE p.oseba_id <> $1
        `, [osebaId])
      ])

      const stFunkcij = funkcijeRes.rows[0]?.n || 0
      const aktivneFunkcije = aktivneFunkcijeRes.rows[0]?.n || 0
      const jeLobist = (lobistRes.rows[0]?.n || 0) > 0
      const jeOvaden = false
      const skupnaPodjetjaZVisokoTveganimi = skupnaTveganaRes.rows[0]?.n || 0

      const score = Math.min(
        100,
        stFunkcij * 4 +
        aktivneFunkcije * 8 +
        (jeLobist ? 25 : 0) +
        (jeOvaden ? 35 : 0) +
        skupnaPodjetjaZVisokoTveganimi * 10
      )

      let stopnja = 'nizka'
      if (score >= 75) stopnja = 'visoka'
      else if (score >= 50) stopnja = 'povišana'
      else if (score >= 25) stopnja = 'zmerna'

      const razlaga = [
        stFunkcij > 0 ? `${stFunkcij} evidentiranih funkcij v podjetjih ali organizacijah` : null,
        aktivneFunkcije > 0 ? `${aktivneFunkcije} aktivnih funkcij` : null,
        jeLobist ? 'oseba je evidentirana kot aktiven lobist' : null,
        skupnaPodjetjaZVisokoTveganimi > 0 ? `${skupnaPodjetjaZVisokoTveganimi} skupnih podjetij z aktivnimi lobisti` : null
      ].filter(Boolean)

      res.json({
        oseba_id: osebaId,
        ime: osebaRes.rows[0].ime,
        priimek: osebaRes.rows[0].priimek,
        score,
        stopnja,
        indikatorji: {
          st_funkcij: stFunkcij,
          aktivne_funkcije: aktivneFunkcije,
          je_lobist: jeLobist,
          je_ovaden: jeOvaden,
          skupna_podjetja_z_visoko_tveganimi: skupnaPodjetjaZVisokoTveganimi
        },
        razlaga,
        opomba: 'Ocena je avtomatski indikator izpostavljenosti na podlagi podatkov v bazi. Ne predstavlja pravne ugotovitve krivde ali odgovornosti.'
      })
    } catch (err) {
      console.error('Napaka pri izračunu tveganja:', err)
      res.status(500).json({ error: err.message })
    }
  })

  // GET /osebe/:id/clanki — članki kjer se pojavi ta oseba (must be before GET /:id)
  router.get('/:id/clanki', async (req, res) => {
    try {
      const result = await dbPool.query(`
        SELECT c.id, c.naslov, c.url, c.vir, c.datum
        FROM clanki c
        JOIN clanki_osebe co ON co.clanek_id = c.id
        WHERE co.oseba_id = $1
        ORDER BY c.datum DESC
        LIMIT 10
      `, [req.params.id])
      res.json(result.rows)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // GET /osebe/:id — profil osebe (general route after specific ones)
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params
      const oseba = await dbPool.query(`SELECT * FROM osebe WHERE id = $1`, [id])
      if (oseba.rows.length === 0) return res.status(404).json({ error: 'Oseba ni najdena' })

      const povezave = await dbPool.query(`
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

  return router
}

const router = createRouter()
module.exports = router
module.exports.createRouter = createRouter
