/**
 * Razveljavi migracijo seedLaboratoriji.js:
 * Premakni vse povezave nazaj iz laboratorijev na UM FERI.
 * Hierarhija: profesor → UM FERI, nato UM FERI → laboratoriji (parent_podjetje_id).
 */
require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  const feriRes = await pool.query(`SELECT id FROM podjetja WHERE maticna = '5089638000'`)
  if (!feriRes.rows.length) { console.error('UM FERI ni najdena'); process.exit(1) }
  const feriId = feriRes.rows[0].id
  console.log(`UM FERI id=${feriId}`)

  const labRes = await pool.query(`SELECT id, popolno_ime FROM podjetja WHERE parent_podjetje_id = $1`, [feriId])
  console.log(`Laboratorijev: ${labRes.rows.length}`)
  labRes.rows.forEach(l => console.log(`  id=${l.id} ${l.popolno_ime}`))

  const labIds = labRes.rows.map(l => l.id)
  if (!labIds.length) { console.log('Ni laboratorijev za obdelavo.'); await pool.end(); return }

  // Korak 1: posodobi lab → UM FERI (samo tisti brez obstoječe UM FERI povezave)
  const upd = await pool.query(`
    UPDATE povezave p
    SET podjetje_id = $1
    WHERE p.podjetje_id = ANY($2)
      AND NOT EXISTS (
        SELECT 1 FROM povezave p2 WHERE p2.oseba_id = p.oseba_id AND p2.podjetje_id = $1
      )
    RETURNING oseba_id
  `, [feriId, labIds])
  console.log(`\n✓ Posodobljenih ${upd.rows.length} povezav → UM FERI`)

  // Korak 2: izbriši preostale lab povezave (oseba ima že UM FERI)
  const del = await pool.query(`
    DELETE FROM povezave WHERE podjetje_id = ANY($1) RETURNING oseba_id
  `, [labIds])
  console.log(`✓ Izbrisanih ${del.rows.length} podvojenih lab povezav`)

  console.log('\n✓ Migracija nazaj uspešna.')
  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
