require('dotenv').config()
const https = require('https')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const RESOURCE_ID = 'beb70929-3d0d-41c6-9af2-25d525d906d3'
const BATCH_SIZE = 1000

function fetchBatch(offset) {
  return new Promise((resolve, reject) => {
    const url = `https://podatki.gov.si/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=${BATCH_SIZE}&offset=${offset}`
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (err) { reject(err) }
      })
      res.on('error', reject)
    })
  })
}

async function sync() {
  console.log('uvoz OPSI podatkov prek API')
  let stevilo = 0
  let napake = 0
  let offset = 0

  try {
    const first = await fetchBatch(0)
    const skupaj = first.result.total
    console.log(`Skupaj podjetij: ${skupaj}`)

    let response = first
    while (offset < skupaj) {
      if (offset > 0) response = await fetchBatch(offset)
      const records = response.result.records
      if (records.length === 0) break

      for (const row of records) {
        try {
          await pool.query(`
            INSERT INTO podjetja 
              (maticna, popolno_ime, hseid, pravna_oblika, registrski_organ, 
               ulica, hisna_stevilka, naselje, postna_stevilka, posta, drzava)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (maticna) DO UPDATE SET
              popolno_ime = EXCLUDED.popolno_ime,
              pravna_oblika = EXCLUDED.pravna_oblika,
              ulica = EXCLUDED.ulica,
              zadnja_posodobitev = NOW()
          `, [
            row['Matična številka'],
            row['Popolno ime'],
            row['HSEID'],
            row['Pravnoorganizacijska oblika'],
            row['Registrski organ'],
            row['Ulica'],
            row['Hišna št'],
            row['Naselje'],
            row['Poštna št'],
            row['Pošta'],
            row['Država']
          ])
          stevilo++
        } catch (err) {
          napake++
          if (napake < 3) console.error('Napaka:', err.message)
        }
      }

      offset += BATCH_SIZE
      console.log(`Uvoženih: ${stevilo} / ${skupaj}`)
    }

    await pool.query(`
      INSERT INTO sync_log (stevilo_zapisov, status)
      VALUES ($1, 'uspeh')
    `, [stevilo])

    console.log(`\nKončano! Uvoženih: ${stevilo}, napake: ${napake}`)

  } catch (err) {
    console.error('Napaka:', err.message)
  } finally {
    await pool.end()
  }
}

sync()