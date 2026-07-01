const express = require('express')
const { execFile } = require('child_process')

module.exports = () => {
  const router = express.Router()

  // POST /scrape — sproži scraping novic (za GitHub Actions cron)
  router.post('/', async (req, res) => {
    const secret = process.env.SCRAPE_SECRET
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    res.json({ status: 'started' })
    execFile('node', ['scripts/scrapeNews.js'], { cwd: process.cwd() }, (err) => {
      if (err) console.error('Scrape napaka:', err.message)
      else console.log('Scrape končan.')
    })
  })

  return router
}