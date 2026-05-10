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
    const result = await pool.query('SELECT NOW()')
    console.log('Povezava uspešna! Čas:', result.rows[0].now)
  } catch (err) {
    console.error('Napaka:', err.message)
  } finally {
    await pool.end()
  }
}

test()