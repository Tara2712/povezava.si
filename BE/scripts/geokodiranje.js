const axios = require('axios')
const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function geocodeCompany(company) {

  let address = `
    ${company.ulica || ''}
    ${company.hisna_stevilka || ''}
    ${company.posta || ''}
  `
    .replace(/\s+/g, ' ')
    .trim()

  const isUniversity =
    company.popolno_ime?.includes('UNIVERZA') ||
    company.popolno_ime?.includes('FAKULTETA')

  if (
    isUniversity &&
    (!company.ulica || !company.posta)
  ) {
    address = `${company.popolno_ime}, Slovenia`
  }

  try {

    const query = encodeURIComponent(address)

    const url =
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`

    const proxy =
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

    const response = await axios.get(proxy)

    const data = response.data

    if (data && data.length > 0) {

      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
    }

  } catch (err) {

    console.log(
      'Napaka:',
      company.popolno_ime
    )
  }

  return null
}

async function main() {

const result = await pool.query(`
  SELECT
    p.id,
    p.maticna,
    p.popolno_ime,
    p.ulica,
    p.hisna_stevilka,
    p.postna_stevilka,
    p.posta
  FROM podjetja p
  LEFT JOIN lokacija l
    ON l.maticna = p.maticna
  WHERE l.maticna IS NULL
  LIMIT 500
`)

  const companies = result.rows

  console.log(`Najdenih podjetij: ${companies.length}`)

  for (let i = 0; i < companies.length; i++) {

    const company = companies[i]

    console.log(`[${i + 1}/${companies.length}]`, company.popolno_ime)

    const existing = await pool.query(`
      SELECT 1
      FROM lokacija
      WHERE maticna = $1
      LIMIT 1
    `, [company.maticna])

    if (existing.rows.length > 0) {
      console.log('SKIP (že obstaja v lokacija)')
      continue
    }

    // 🔥 geocoding
    const coords = await geocodeCompany(company)

    if (coords) {

      // 🔥 shrani samo osnovne podatke
      await pool.query(`
        INSERT INTO lokacija (
          maticna,
          lat,
          lng
        )
        VALUES ($1, $2, $3)
      `, [
        company.maticna,
        coords.lat,
        coords.lng
      ])

      console.log('SHRANJENO v lokacija')
    }

    await sleep(1200)
  }

  console.log('KONČANO')
}

main()