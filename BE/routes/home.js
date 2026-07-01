const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  let homeCache = null
  let homeCacheAt = 0
  const HOME_CACHE_TTL = 60 * 1000 // 60 sekund

  // GET /api/home
  router.get('/', async (req, res) => {
    try {
      const now = Date.now()

      if (homeCache && now - homeCacheAt < HOME_CACHE_TTL) {
        return res.json(homeCache)
      }

      const [topPoslovnezi, topAkademiki, clanki, stats, lobisti, ovadeni] = await Promise.all([
        pool.query(`
          SELECT o.id, o.ime, o.priimek, o.tip, o.fotografija_url, o.institucija, o.naziv,
            COUNT(p.id) AS stevilo_povezav
          FROM osebe o
          LEFT JOIN povezave p ON p.oseba_id = o.id
          WHERE o.tip = 'poslovnez'
          GROUP BY o.id
          ORDER BY stevilo_povezav DESC
          LIMIT 4
        `),

        pool.query(`
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
          LIMIT 4
        `),

        pool.query(`
          SELECT c.id, c.naslov, c.url, c.vir, c.datum
          FROM clanki c
          WHERE EXISTS (
            SELECT 1
            FROM clanki_osebe co
            JOIN osebe o ON o.id = co.oseba_id
            WHERE co.clanek_id = c.id
              AND o.ime IS NOT NULL
              AND o.priimek IS NOT NULL
              AND LENGTH(TRIM(o.ime)) >= 2
              AND LENGTH(TRIM(o.priimek)) >= 2
          )
          ORDER BY c.datum DESC
          LIMIT 3
        `),

        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM osebe) AS osebe,
            (SELECT COUNT(*) FROM podjetja) AS podjetja,
            (SELECT COUNT(*) FROM povezave) AS povezave
        `),

        pool.query(`SELECT COUNT(*) AS skupaj FROM lobisti_info WHERE datum_izpisa IS NULL`),

        pool.query(`SELECT COUNT(*) AS skupaj FROM ovadeni_info`)
      ])

      homeCache = {
        topPoslovnezi: topPoslovnezi.rows,
        topAkademiki: topAkademiki.rows,
        clanki: clanki.rows,
        stats: stats.rows[0],
        lobCount: Number(lobisti.rows[0]?.skupaj || 0),
        ovCount: Number(ovadeni.rows[0]?.skupaj || 0)
      }

      homeCacheAt = now
      res.json(homeCache)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}