require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})


const graf = {
  osebe: new Map(),            
  podjetja: new Map(),         
  oseba_podjetja: new Map(),   
  podjetje_osebe: new Map(),   
  oseba_oseba: new Map(),      
  podjetje_podjetje: new Map() 
}

let grafNalozEN = false

async function nalogajGraf() {
  if (grafNalozEN) return
  console.log('Nalagam graf v pomnilnik...')

  const podjetja = await pool.query(`
    SELECT maticna, popolno_ime, posta FROM podjetja
  `)
  for (const p of podjetja.rows) {
    graf.podjetja.set(p.maticna, {
      naziv: p.popolno_ime,
      posta: p.posta
    })
  }
  console.log(`  Podjetij: ${graf.podjetja.size}`)

  const osebe = await pool.query(`
    SELECT id, ime, priimek, tip FROM osebe
  `)
  for (const o of osebe.rows) {
    graf.osebe.set(o.id, {
      ime: o.ime,
      priimek: o.priimek,
      tip: o.tip
    })
  }
  console.log(`  Oseb: ${graf.osebe.size}`)

  const povezave = await pool.query(`
    SELECT 
      p.oseba_id,
      p.oseba2_id,
      pod.maticna AS podjetje_maticna,
      pod2.maticna AS podjetje2_maticna,
      p.vloga,
      p.tip_povezave
    FROM povezave p
    LEFT JOIN podjetja pod ON p.podjetje_id = pod.id
    LEFT JOIN podjetja pod2 ON p.podjetje2_id = pod2.id
  `)

  for (const l of povezave.rows) {

    // oseba - podjetje
    if (l.oseba_id && l.podjetje_maticna) {
      if (!graf.oseba_podjetja.has(l.oseba_id)) {
        graf.oseba_podjetja.set(l.oseba_id, new Set())
      }
      graf.oseba_podjetja.get(l.oseba_id).add(l.podjetje_maticna)

      if (!graf.podjetje_osebe.has(l.podjetje_maticna)) {
        graf.podjetje_osebe.set(l.podjetje_maticna, new Set())
      }
      graf.podjetje_osebe.get(l.podjetje_maticna).add(l.oseba_id)
    }

    // oseba - oseba
    if (l.oseba_id && l.oseba2_id) {
      if (!graf.oseba_oseba.has(l.oseba_id)) {
        graf.oseba_oseba.set(l.oseba_id, new Set())
      }
      graf.oseba_oseba.get(l.oseba_id).add(l.oseba2_id)
      if (!graf.oseba_oseba.has(l.oseba2_id)) {
        graf.oseba_oseba.set(l.oseba2_id, new Set())
      }
      graf.oseba_oseba.get(l.oseba2_id).add(l.oseba_id)
    }

    // podjetje - podjetje
    if (l.podjetje_maticna && l.podjetje2_maticna) {
      if (!graf.podjetje_podjetje.has(l.podjetje_maticna)) {
        graf.podjetje_podjetje.set(l.podjetje_maticna, new Set())
      }
      graf.podjetje_podjetje.get(l.podjetje_maticna).add(l.podjetje2_maticna)
    }
  }

  grafNalozEN = true
  console.log(`  Oseba-podjetje: ${graf.oseba_podjetja.size}`)
  console.log(`  Oseba-oseba: ${graf.oseba_oseba.size}`)
  console.log(`  Podjetje-podjetje: ${graf.podjetje_podjetje.size}`)
  console.log('Graf naložen!')
}

function najdiPot(odId, doId, maxStopnje = 6) {
  if (odId === doId) return []

  const vrsta = [{ osebaId: odId, pot: [] }]
  const obiskane = new Set([`oseba_${odId}`])

  while (vrsta.length > 0) {
    const { osebaId, pot } = vrsta.shift()

    if (pot.length >= maxStopnje * 2) continue

    // podjetij - oseba - podjetje - oseba
    const podjetjaOsebe = graf.oseba_podjetja.get(osebaId) || new Set()
    for (const maticna of podjetjaOsebe) {
      const soosebe = graf.podjetje_osebe.get(maticna) || new Set()
      for (const soosebaId of soosebe) {
        const nodeKey = `oseba_${soosebaId}`
        if (obiskane.has(nodeKey)) continue
        obiskane.add(nodeKey)

        const podjetjeInfo = graf.podjetja.get(maticna) || {}
        const osebaInfo = graf.osebe.get(soosebaId) || {}

        const novaPot = [
          ...pot,
          { tip: 'podjetje', maticna, naziv: podjetjeInfo.naziv || maticna },
          { tip: 'oseba', id: soosebaId, ime: `${osebaInfo.ime || ''} ${osebaInfo.priimek || ''}`.trim() }
        ]

        if (soosebaId === doId) return novaPot
        vrsta.push({ osebaId: soosebaId, pot: novaPot })
      }

      // podjetje-podjetje
      const sopodjeja = graf.podjetje_podjetje.get(maticna) || new Set()
      for (const maticna2 of sopodjeja) {
        const nodeKey = `podjetje_${maticna2}`
        if (obiskane.has(nodeKey)) continue
        obiskane.add(nodeKey)

        const soosebe2 = graf.podjetje_osebe.get(maticna2) || new Set()
        for (const soosebaId of soosebe2) {
          const nodeKeyO = `oseba_${soosebaId}`
          if (obiskane.has(nodeKeyO)) continue
          obiskane.add(nodeKeyO)

          const podjetjeInfo2 = graf.podjetja.get(maticna2) || {}
          const osebaInfo = graf.osebe.get(soosebaId) || {}

          const novaPot = [
            ...pot,
            { tip: 'podjetje', maticna, naziv: (graf.podjetja.get(maticna) || {}).naziv || maticna },
            { tip: 'podjetje', maticna: maticna2, naziv: podjetjeInfo2.naziv || maticna2 },
            { tip: 'oseba', id: soosebaId, ime: `${osebaInfo.ime || ''} ${osebaInfo.priimek || ''}`.trim() }
          ]

          if (soosebaId === doId) return novaPot
          vrsta.push({ osebaId: soosebaId, pot: novaPot })
        }
      }
    }

    // oseba - oseba
    const soosebe2 = graf.oseba_oseba.get(osebaId) || new Set()
    for (const soosebaId of soosebe2) {
      const nodeKey = `oseba_${soosebaId}`
      if (obiskane.has(nodeKey)) continue
      obiskane.add(nodeKey)

      const osebaInfo = graf.osebe.get(soosebaId) || {}
      const novaPot = [
        ...pot,
        { tip: 'oseba_direktno', id: soosebaId, ime: `${osebaInfo.ime || ''} ${osebaInfo.priimek || ''}`.trim() }
      ]

      if (soosebaId === doId) return novaPot
      vrsta.push({ osebaId: soosebaId, pot: novaPot })
    }
  }

  return null
}

function isciOsebo(query) {
  const q = query.toLowerCase().trim()
  const rezultati = []

  for (const [id, oseba] of graf.osebe) {
    const polnoIme = `${oseba.ime || ''} ${oseba.priimek || ''}`.toLowerCase()
    if (polnoIme.includes(q)) {
      rezultati.push({
        id,
        ime: oseba.ime,
        priimek: oseba.priimek,
        tip: oseba.tip,
        steviloPovezav: graf.oseba_podjetja.get(id)?.size || 0
      })
    }
    if (rezultati.length >= 10) break
  }

  return rezultati
}

function formatZaFrontend(odId, doId, pot) {
  const nodes = []
  const edges = []
  const dodaniNodes = new Set()

  const odOseba = graf.osebe.get(odId) || {}
  nodes.push({
    id: `oseba_${odId}`,
    label: `${odOseba.ime || ''} ${odOseba.priimek || ''}`.trim(),
    group: 'oseba',
    color: { background: '#4A90D9', border: '#2171B5' }
  })
  dodaniNodes.add(`oseba_${odId}`)

  let prejsnjiId = `oseba_${odId}`

  for (const korak of pot) {
    if (korak.tip === 'podjetje') {
      const nodeId = `podjetje_${korak.maticna}`
      if (!dodaniNodes.has(nodeId)) {
        nodes.push({
          id: nodeId,
          label: korak.naziv?.substring(0, 40) || korak.maticna,
          group: 'podjetje',
          color: { background: '#F5A623', border: '#D4861A' }
        })
        dodaniNodes.add(nodeId)
      }
      edges.push({ from: prejsnjiId, to: nodeId })
      prejsnjiId = nodeId

    } else if (korak.tip === 'oseba' || korak.tip === 'oseba_direktno') {
      const nodeId = `oseba_${korak.id}`
      if (!dodaniNodes.has(nodeId)) {
        const jeCilj = korak.id === doId
        nodes.push({
          id: nodeId,
          label: korak.ime,
          group: 'oseba',
          color: {
            background: jeCilj ? '#E74C3C' : '#4A90D9',
            border: jeCilj ? '#C0392B' : '#2171B5'
          }
        })
        dodaniNodes.add(nodeId)
      }
      edges.push({
        from: prejsnjiId,
        to: nodeId,
        dashes: korak.tip === 'oseba_direktno'
      })
      prejsnjiId = nodeId
    }
  }

  return { nodes, edges }
}

function setupRoutes(app) {
  // Iskanje osebe
  app.get('/api/bfs/isci', async (req, res) => {
    await nalogajGraf()
    const { q } = req.query
    if (!q) return res.status(400).json({ error: 'Manjka parameter q' })
    res.json(isciOsebo(q))
  })

  // Iskanje poti
  app.get('/api/bfs/pot', async (req, res) => {
    await nalogajGraf()
    const { od, do: do_ } = req.query

    if (!od || !do_) {
      return res.status(400).json({ error: 'Manjkata parametra od in do' })
    }

    const odId = parseInt(od)
    const doId = parseInt(do_)

    if (!graf.osebe.has(odId)) return res.status(404).json({ error: `Oseba z ID ${odId} ni najdena` })
    if (!graf.osebe.has(doId)) return res.status(404).json({ error: `Oseba z ID ${doId} ni najdena` })

    console.log(`Iščem pot: ${odId} → ${doId}`)
    const zacetek = Date.now()
    const pot = najdiPot(odId, doId)
    const cas = Date.now() - zacetek

    if (!pot) {
      return res.json({ najdeno: false, sporocilo: 'Ni povezave v 6 stopnjah' })
    }

    const grafData = formatZaFrontend(odId, doId, pot)

    res.json({
      najdeno: true,
      stopnje: pot.filter(k => k.tip === 'oseba' || k.tip === 'oseba_direktno').length,
      cas_ms: cas,
      pot,
      graf: grafData
    })
  })

  // Status grafa
  app.get('/api/bfs/status', async (req, res) => {
    await nalogajGraf()
    res.json({
      oseb: graf.osebe.size,
      podjetij: graf.podjetja.size,
      oseba_podjetja: graf.oseba_podjetja.size,
      oseba_oseba: graf.oseba_oseba.size,
      podjetje_podjetje: graf.podjetje_podjetje.size
    })
  })
}

module.exports = { nalogajGraf, setupRoutes }