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
      id,
      popolno_ime,
      ulica,
      hisna_stevilka,
      postna_stevilka,
      posta
    FROM podjetja
    WHERE lat IS NULL
    LIMIT 500
  `)

  const companies = result.rows

  console.log(
    `Najdenih podjetij: ${companies.length}`
  )

  for (let i = 0; i < companies.length; i++) {

    const company = companies[i]

    console.log(
      `[${i + 1}/${companies.length}]`,
      company.popolno_ime
    )

    const coords =
      await geocodeCompany(company)

    if (coords) {

      await pool.query(`
        UPDATE podjetja
        SET lat = $1,
            lng = $2
        WHERE id = $3
      `, [
        coords.lat,
        coords.lng,
        company.id
      ])

      console.log('SHRANJENO')
    }

    await sleep(1200)
  }

  console.log('KONČANO')
}

main()