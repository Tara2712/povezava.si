/**
 * Ustvari tabele za lobiste in kazensko ovadene.
 * Zaženi enkrat: node scripts/setupLobistiOvadeni.js
 */
require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  // Lobisti — dodamo tip='lobist' v obstoječo tabelo osebe
  // + tabela lobisti_info za specifične podatke
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lobisti_info (
      id           SERIAL PRIMARY KEY,
      oseba_id     INTEGER REFERENCES osebe(id) ON DELETE CASCADE,
      delodajalec  TEXT,
      narocnik     TEXT,
      datum_vpisa  DATE,
      datum_izpisa DATE,
      registrska_st TEXT,
      vir_url      TEXT,
      UNIQUE(oseba_id)
    )
  `)
  console.log('✓ Tabela lobisti_info')

  // Kazensko ovadeni — ločena tabela (oseba je morda že v bazi ali pa ne)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ovadeni (
      id           SERIAL PRIMARY KEY,
      ime          TEXT NOT NULL,
      priimek      TEXT NOT NULL,
      oseba_id     INTEGER REFERENCES osebe(id) ON DELETE SET NULL,
      zadeva       TEXT,
      opis         TEXT,
      datum        DATE,
      sodisce      TEXT,
      status       TEXT,
      vir          TEXT,
      vir_url      TEXT,
      ustvarjeno   TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('✓ Tabela ovadeni')

  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
