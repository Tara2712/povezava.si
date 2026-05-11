require('dotenv').config({ path: '.env.test' })
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_TEST,
  ssl: { rejectUnauthorized: false }
})

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS podjetja (
        id SERIAL PRIMARY KEY,
        maticna VARCHAR(20) UNIQUE NOT NULL,
        popolno_ime VARCHAR(500),
        hseid VARCHAR(100),
        pravna_oblika VARCHAR(100),
        registrski_organ VARCHAR(200),
        ulica VARCHAR(200),
        hisna_stevilka VARCHAR(50),
        naselje VARCHAR(200),
        postna_stevilka VARCHAR(10),
        posta VARCHAR(100),
        drzava VARCHAR(100),
        zadnja_posodobitev TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('Tabela podjetja ustvarjena.')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS osebe (
        id SERIAL PRIMARY KEY,
        ime VARCHAR(200),
        priimek VARCHAR(200),
        datum_rojstva DATE,
        zadnja_posodobitev TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('Tabela osebe ustvarjena.')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS povezave (
        id SERIAL PRIMARY KEY,
        oseba_id INTEGER REFERENCES osebe(id) ON DELETE CASCADE,
        podjetje_id INTEGER REFERENCES podjetja(id) ON DELETE CASCADE,
        vloga VARCHAR(100),
        delez DECIMAL(5,2),
        datum_od DATE,
        datum_do DATE,
        vir VARCHAR(200),
        zadnja_posodobitev TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('Tabela povezave ustvarjena.')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id SERIAL PRIMARY KEY,
        datum TIMESTAMP DEFAULT NOW(),
        vir VARCHAR(100),
        stevilo_zapisov INTEGER,
        status VARCHAR(50),
        sporocilo TEXT
      )
    `)
    console.log('Tabela sync_log ustvarjena.')

    console.log('\nTestna baza uspešno vzpostavljena!')
  } catch (err) {
    console.error('Napaka pri vzpostavitvi baze:', err.message)
  } finally {
    await pool.end()
  }
}

setup()
