require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Vstavi UM FERI kot organizacijo v podjetja (če še ni)
    const orgRes = await client.query(`
      INSERT INTO podjetja (popolno_ime, pravna_oblika, posta, maticna)
      VALUES (
        'Univerza v Mariboru, Fakulteta za elektrotehniko, računalništvo in informatiko',
        'Javni zavod',
        'Maribor',
        '5089638000'
      )
      ON CONFLICT (maticna) DO NOTHING
      RETURNING id
    `)

    let feriId
    if (orgRes.rows.length > 0) {
      feriId = orgRes.rows[0].id
      console.log(`Dodan UM FERI z id=${feriId}`)
    } else {
      const existing = await client.query(
        `SELECT id FROM podjetja WHERE maticna = '5089638000'`
      )
      feriId = existing.rows[0]?.id
      if (!feriId) {
        // fallback: poisci po imenu
        const byName = await client.query(
          `SELECT id FROM podjetja WHERE popolno_ime ILIKE '%FERI%' OR popolno_ime ILIKE '%elektrotehniko%' LIMIT 1`
        )
        feriId = byName.rows[0]?.id
      }
      console.log(`UM FERI že obstaja, id=${feriId}`)
    }

    if (!feriId) {
      console.error('Ne najdem UM FERI v podjetja — prekinjam.')
      await client.query('ROLLBACK')
      return
    }

    // Povezi vse akademike z UM FERI
    const akademiki = await client.query(`
      SELECT id, ime, priimek, opis FROM osebe WHERE tip = 'akademik'
    `)
    console.log(`Akademikov za povezati: ${akademiki.rows.length}`)

    let dodanih = 0, preskocenih = 0
    for (const o of akademiki.rows) {
      // Določi vlogo iz opis polja
      const vloga = izlociVlogo(o.opis) || 'Raziskovalec'

      // Preveri če povezava že obstaja
      const check = await client.query(
        `SELECT id FROM povezave WHERE oseba_id = $1 AND podjetje_id = $2`,
        [o.id, feriId]
      )
      if (check.rows.length > 0) {
        preskocenih++
        continue
      }

      await client.query(`
        INSERT INTO povezave (oseba_id, podjetje_id, vloga, vir)
        VALUES ($1, $2, $3, 'ii.feri.um.si')
      `, [o.id, feriId, vloga])
      dodanih++
      console.log(`  + ${o.ime} ${o.priimek} — ${vloga}`)
    }

    await client.query('COMMIT')
    console.log(`\nDodanih: ${dodanih}, preskočenih (že obstajajo): ${preskocenih}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Napaka:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

function izlociVlogo(opis) {
  if (!opis) return null
  const o = opis.toLowerCase()
  if (o.includes('predstojnik inštituta')) return 'Predstojnik inštituta'
  if (o.includes('namestnik predstojnika')) return 'Namestnik predstojnika'
  if (o.includes('redni profesor')) return 'Redni profesor'
  if (o.includes('izredni profesor')) return 'Izredni profesor'
  if (o.includes('docent')) return 'Docent'
  if (o.includes('višji predavatelj')) return 'Višji predavatelj'
  if (o.includes('predavatelj')) return 'Predavatelj'
  if (o.includes('mladi raziskovalec')) return 'Mladi raziskovalec'
  if (o.includes('asistent')) return 'Asistent'
  if (o.includes('tehnični sodelavec')) return 'Tehnični sodelavec'
  return null
}

main()
