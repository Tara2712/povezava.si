/**
 * Migracija: doda laboratorije UM FERI kot podjetja, hierarhijo,
 * in preusmeri akademike iz UM FERI → njihov laboratorij.
 */
require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const LABS = [
  { ime: 'Laboratorij za informacijske sisteme',    maticna: 'UMFERI-LAB-IS',  kljucna: ['informacijske sisteme'] },
  { ime: 'Laboratorij za inteligentne sisteme',     maticna: 'UMFERI-LAB-INT', kljucna: ['inteligentne sisteme'] },
  { ime: 'Laboratorij za podatkovne tehnologije',   maticna: 'UMFERI-LAB-PT',  kljucna: ['podatkovne tehnologije'] },
  { ime: 'Laboratorij za sisteme v realnem času',   maticna: 'UMFERI-LAB-SRC', kljucna: ['sisteme v realnem', 'realnem času'] },
]

function dolocilLab(opis, labIds) {
  if (!opis) return labIds['UMFERI-LAB-IS']
  const o = opis.toLowerCase()
  for (const lab of LABS) {
    if (lab.kljucna.some(k => o.includes(k))) return labIds[lab.maticna]
  }
  return labIds['UMFERI-LAB-IS']
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Dodaj parent_podjetje_id kolono
    await client.query(`ALTER TABLE podjetja ADD COLUMN IF NOT EXISTS parent_podjetje_id INT`)
    console.log('✓ parent_podjetje_id kolona')

    // 2. Poišči UM FERI
    const feriRes = await client.query(`SELECT id FROM podjetja WHERE maticna = '5089638000'`)
    const feriId = feriRes.rows[0]?.id
    if (!feriId) throw new Error('UM FERI ni v bazi — najprej poženi scrapeAkademikiProfili.js')
    console.log(`✓ UM FERI id=${feriId}`)

    // 3. Vstavi laboratorije
    const labIds = {}
    for (const lab of LABS) {
      const res = await client.query(`
        INSERT INTO podjetja (popolno_ime, pravna_oblika, posta, maticna, parent_podjetje_id)
        VALUES ($1, 'Laboratorij', 'Maribor', $2, $3)
        ON CONFLICT (maticna) DO UPDATE
          SET parent_podjetje_id = EXCLUDED.parent_podjetje_id,
              popolno_ime = EXCLUDED.popolno_ime
        RETURNING id
      `, [lab.ime, lab.maticna, feriId])
      labIds[lab.maticna] = res.rows[0].id
      console.log(`  Lab "${lab.ime}" → id=${res.rows[0].id}`)
    }

    // 4. Preusmeri akademike: UM FERI → pravi laboratorij
    const akademiki = await client.query(`
      SELECT o.id AS oseba_id, o.opis, p.id AS povezava_id
      FROM osebe o
      JOIN povezave p ON p.oseba_id = o.id AND p.podjetje_id = $1
      WHERE o.tip = 'akademik'
    `, [feriId])
    console.log(`\n✓ Preusmeritev ${akademiki.rows.length} akademikov UM FERI → laboratorij`)

    for (const a of akademiki.rows) {
      const labId = dolocilLab(a.opis, labIds)
      await client.query(`UPDATE povezave SET podjetje_id = $1 WHERE id = $2`, [labId, a.povezava_id])
    }

    // 5. Poskrbi da so akademiki brez povezave dobili pravo lab
    const brezPovezave = await client.query(`
      SELECT o.id, o.opis FROM osebe o
      WHERE o.tip = 'akademik'
        AND NOT EXISTS (
          SELECT 1 FROM povezave p
          WHERE p.oseba_id = o.id AND p.podjetje_id = ANY($1::int[])
        )
    `, [Object.values(labIds)])

    for (const a of brezPovezave.rows) {
      const labId = dolocilLab(a.opis, labIds)
      await client.query(`
        INSERT INTO povezave (oseba_id, podjetje_id, vloga, vir)
        VALUES ($1, $2, 'Zaposleni', 'ii.feri.um.si')
        ON CONFLICT (oseba_id, podjetje_id) DO NOTHING
      `, [a.id, labId])
      console.log(`  + Dodan ${a.id} → lab ${labId}`)
    }

    await client.query('COMMIT')
    console.log('\n✓ Migracija uspešna.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Napaka:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
