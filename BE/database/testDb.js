require('dotenv').config()
const { Pool } = require('pg')

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'nastavljen' : 'NI nastavljen!')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function test() {
  try {
    console.log('Poskušam se povezati...')

    const timeResult = await pool.query('SELECT NOW()')
    console.log('Povezava uspešna! Čas:', timeResult.rows[0].now)

    const tableResult = await pool.query(`
      SELECT COUNT(*) 
      FROM podjetja
    `)

    console.log('Število podjetij v tabeli:', tableResult.rows[0].count)

    //dela!!!
    const sampleResult = await pool.query(`
      SELECT maticna, popolno_ime, posta, pravna_oblika
      FROM podjetja
      LIMIT 5
    `)

    console.log('Primeri podjetij:')
    console.table(sampleResult.rows)

  } catch (err) {
    console.error('Napaka:', err.message)
  } finally {
    await pool.end()
  }
}

test()