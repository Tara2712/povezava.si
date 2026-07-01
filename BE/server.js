require('dotenv').config()
const express = require('express')
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')
const axios = require('axios')
const OpenAI = require('openai')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const bfsRoutes = require('./test6Degrees/bfs_nova')


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

bfsRoutes.setupRoutes(app) // že naloži gemini_ai.js in google_search.js

/* const bfs = require('./test6Degrees/bfs')
bfs.nalogajGraf() 
bfs.setupRoutes(app) */

const routesDir = path.join(__dirname, 'routes')
const routePrefixes = {
  ai: '/ai',
  akademiki: '/akademiki',
  clanki: '/clanki',
  globalSearch: '/search',
  home: '/home',
  kordinate: '/kordinate',
  lobisti: '/lobisti',
  omrezje: '/omrezje',
  osebe: '/osebe',
  ovadeni: '/ovadeni',
  podjetja: '/podjetja',
  pot: '/pot',
  povezave: '/povezave',
  scrape: '/scrape',
  search: '/search',
  stats: '/stats',
  watchlist: '/watchlist'
}

for (const file of fs.readdirSync(routesDir).filter((name) => name.endsWith('.js') && name !== 'index.js')) {
  const routePath = path.join(routesDir, file)
  const loadedRoute = require(routePath)
  const routeName = path.basename(file, '.js')

  if (loadedRoute && typeof loadedRoute.setupRoutes === 'function') {
    loadedRoute.setupRoutes(app)
    continue
  }

  const router = loadedRoute && typeof loadedRoute.handle === 'function'
    ? loadedRoute
    : typeof loadedRoute === 'function'
      ? loadedRoute(pool)
      : loadedRoute && typeof loadedRoute.createRouter === 'function'
        ? loadedRoute.createRouter(pool)
        : null

  if (router && typeof router.handle === 'function') {
    const prefix = routePrefixes[routeName] || `/${routeName}`
    app.use(prefix, router)
    app.use(`/api${prefix}`, router)
  }
}


app.listen(PORT, () => {
  console.log(`Server teče na portu ${PORT}`)
})

module.exports = app