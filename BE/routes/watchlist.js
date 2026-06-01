const express = require('express')
const router = express.Router()
const nodemailer = require('nodemailer')
const cron = require('node-cron')

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  })
}

async function sendMail(to, subject, html) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return
  await makeTransporter().sendMail({
    from: `"Povezava.si" <${process.env.GMAIL_USER}>`,
    to, subject, html
  })
}

module.exports = function(pool) {
  // GET /api/watchlist?email=xxx — vrni seznam sledenih oseb
  router.get('/', async (req, res) => {
    const { email } = req.query
    if (!email) return res.status(400).json({ error: 'Manjka email' })
    try {
      const r = await pool.query(`
        SELECT o.id, o.ime, o.priimek, o.fotografija_url, o.institucija
        FROM watchlist w JOIN osebe o ON o.id = w.oseba_id
        WHERE w.user_email = $1 ORDER BY w.created_at DESC
      `, [email])
      res.json(r.rows)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/watchlist — sledi osebi + pošlji potrditveni email
  router.post('/', async (req, res) => {
    const { email, oseba_id } = req.body
    if (!email || !oseba_id) return res.status(400).json({ error: 'Manjka email ali oseba_id' })
    try {
      const insert = await pool.query(
        'INSERT INTO watchlist (user_email, oseba_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
        [email, oseba_id]
      )
      // Pošlji potrditveni email samo ob novi sledenju (ne ob podvojenem kliku)
      if (insert.rows.length > 0) {
        const oseba = await pool.query('SELECT ime, priimek FROM osebe WHERE id=$1', [oseba_id])
        const o = oseba.rows[0]
        if (o) {
          sendMail(
            email,
            `Zdaj sledite osebi ${o.ime} ${o.priimek} — Povezava.si`,
            `<h2>Sledenje potrjeno</h2>
             <p>Uspešno sledite osebi <strong>${o.ime} ${o.priimek}</strong>.</p>
             <p>Obvestili vas bomo, ko bo oseba dobila novo poslovno povezavo ali se bo pojavila v medijih.</p>
             <p><a href="https://povezava-si.vercel.app/profil">Oglejte si svoje sledene osebe →</a></p>
             <p style="color:#999;font-size:12px">Povezava.si — slovensko omrežje poslovnih povezav</p>`
          ).catch(e => console.warn('Email napaka:', e.message))
        }
      }
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // DELETE /api/watchlist — odsledi osebi
  router.delete('/', async (req, res) => {
    const { email, oseba_id } = req.body
    if (!email || !oseba_id) return res.status(400).json({ error: 'Manjka email ali oseba_id' })
    try {
      await pool.query('DELETE FROM watchlist WHERE user_email=$1 AND oseba_id=$2', [email, oseba_id])
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Cron job — vsak dan ob 8:00 pošlji obvestila
  if (process.env.GMAIL_USER) {
    cron.schedule('0 8 * * *', async () => {
      console.log('Watchlist cron: preverjam spremembe...')
      try {
        const pairs = await pool.query(`
          SELECT DISTINCT w.user_email, w.oseba_id, o.ime, o.priimek
          FROM watchlist w JOIN osebe o ON o.id = w.oseba_id
        `)
        const byEmail = {}
        for (const row of pairs.rows) {
          const novePovezave = await pool.query(`
            SELECT d.popolno_ime, p.vloga FROM povezave p
            JOIN podjetja d ON d.id = p.podjetje_id
            WHERE p.oseba_id = $1 AND p.created_at >= NOW() - INTERVAL '24 hours'
            LIMIT 5
          `, [row.oseba_id])
          if (novePovezave.rows.length > 0) {
            if (!byEmail[row.user_email]) byEmail[row.user_email] = []
            byEmail[row.user_email].push({ ime: `${row.ime} ${row.priimek}`, povezave: novePovezave.rows })
          }
        }
        for (const [email, spremembe] of Object.entries(byEmail)) {
          const seznam = spremembe.map(s =>
            `<li><strong>${s.ime}</strong>: ${s.povezave.map(p => `${p.vloga} pri ${p.popolno_ime}`).join(', ')}</li>`
          ).join('')
          await sendMail(
            email,
            'Novosti pri sledenih osebah — Povezava.si',
            `<h2>Novosti pri osebah ki jim sledite</h2><ul>${seznam}</ul>
             <p><a href="https://povezava-si.vercel.app/profil">Oglejte si profil →</a></p>
             <p style="color:#999;font-size:12px">Povezava.si</p>`
          )
            from: 'Povezava.si <onboarding@resend.dev>',
            to: email,
            subject: 'Novosti pri sledenih osebah — Povezava.si',
            html: `
              <h2>Novosti pri osebah ki jim sledite</h2>
              <ul>${seznam}</ul>
              <p><a href="https://povezava-si.vercel.app/profil">Oglejte si profil →</a></p>
          console.log(`Email poslan: ${email}`)
        }
      } catch (e) {
        console.error('Cron napaka:', e.message)
      }
    })
    console.log('Watchlist cron job aktiven (vsak dan ob 8:00)')
  }

  return router
}
