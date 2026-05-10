require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function setup() {
  try {
    // Tabela za podjetja (OPSI podatki)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS podjetja (
        id SERIAL PRIMARY KEY,
        maticna VARCHAR(10) UNIQUE NOT NULL,
        naziv VARCHAR(500),
        kratki_naziv VARCHAR(500),
        naslov VARCHAR(500),
        posta VARCHAR(100),
        pravna_oblika VARCHAR(100),
        zadnja_posodobitev TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('Tabela podjetja ustvarjena!')

    // Tabela za osebe (lastniki, direktorji)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS osebe (
        id SERIAL PRIMARY KEY,
        ime VARCHAR(200),
        priimek VARCHAR(200),
        zadnja_posodobitev TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('Tabela osebe ustvarjena!')

    // Tabela za povezave med osebami in podjetji
    await pool.query(`
      CREATE TABLE IF NOT EXISTS povezave (
        id SERIAL PRIMARY KEY,
        oseba_id INTEGER REFERENCES osebe(id),
        podjetje_id INTEGER REFERENCES podjetja(id),
        vloga VARCHAR(100),
        delez DECIMAL(5,2),
        datum_od DATE,
        datum_do DATE,
        zadnja_posodobitev TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('Tabela povezave ustvarjena!')

    // Log sinhronizacij
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id SERIAL PRIMARY KEY,
        datum TIMESTAMP DEFAULT NOW(),
        stevilo_zapisov INTEGER,
        status VARCHAR(50)
      )
    `)
    console.log('Tabela sync_log ustvarjena!')

    console.log('Vse tabele uspešno ustvarjene!')
  } catch (err) {
    console.error('Napaka:', err.message)
  } finally {
    await pool.end()
  }
}

setup()