require('dotenv').config()
const https = require('https')
const { parse } = require('csv-parse')
const iconv = require('iconv-lite')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const CSV_URL = 'https://podatki.gov.si/dataset/9ee1a9aa-c224-4995-b2ad-3760d7af0748/resource/beb70929-3d0d-41c6-9af2-25d525d906d3/download/opsiprs.csv'

async function sync() {
  console.log('Začenjam uvoz OPSI podatkov...')
  let stevilo = 0
  let napake = 0
  let firstChunk = true

  return new Promise((resolve, reject) => {
    https.get(CSV_URL, (res) => {
      const chunks = []

      res.on('data', (chunk) => {
        // Odstrani BOM iz prvega chunka
        if (firstChunk) {
          firstChunk = false
          // Odstrani UTF-16 LE BOM (FF FE) ali UTF-8 BOM (EF BB BF)
          if (chunk[0] === 0xFF && chunk[1] === 0xFE) {
            chunk = chunk.slice(2)
          } else if (chunk[0] === 0xEF && chunk[1] === 0xBB && chunk[2] === 0xBF) {
            chunk = chunk.slice(3)
          }
        }
        chunks.push(chunk)
      })

      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const decoded = iconv.decode(buffer, 'win1250')

        const parser = parse({
          delimiter: ',',
          quote: '"',
          columns: true,
          skip_empty_lines: true,
          trim: true
        })

        parser.on('data', async (row) => {
          parser.pause()
          try {
            const keys = Object.keys(row)
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
              row[keys[0]],   // Matična številka
              row[keys[1]],   // Popolno ime
              row[keys[2]],   // HSEID
              row[keys[3]],   // Pravna oblika
              row[keys[4]],   // Registrski organ
              row[keys[5]],   // Ulica
              row[keys[6]],   // Hišna številka
              row[keys[8]],   // Naselje
              row[keys[9]],   // Poštna številka
              row[keys[10]],  // Pošta
              row[keys[11]]   // Država
            ])
            stevilo++
            if (stevilo % 1000 === 0) console.log(`Uvoženih: ${stevilo}`)
          } catch (err) {
            napake++
            if (napake < 5) console.error('Napaka:', err.message)
          }
          parser.resume()
        })

        parser.on('end', async () => {
          await pool.query(`
            INSERT INTO sync_log (stevilo_zapisov, status)
            VALUES ($1, 'uspeh')
          `, [stevilo])
          console.log(`Končano! Uvoženih: ${stevilo}, napake: ${napake}`)
          await pool.end()
          resolve()
        })

        parser.on('error', reject)
        parser.write(decoded)
        parser.end()
      })

      res.on('error', reject)
    })
  })
}

sync().catch(console.error)