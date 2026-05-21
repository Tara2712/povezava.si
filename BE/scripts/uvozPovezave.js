require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const DRY_RUN = process.env.DRY_RUN === 'true'

async function countQuery(name, sql, params = []) {
  const result = await pool.query(sql, params)
  const count = Number(result.rows[0].count)

  console.log(`${name}: ${count}`)

  return count
}

async function insertQuery(name, sql, params = []) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] ${name} — ne vstavljam v bazo.`)
    return
  }

  const result = await pool.query(sql, params)
  console.log(`${name}: dodanih ${result.rowCount}`)
}

async function povezaveOsebaPodjetjePoMaticni() {
  console.log('\n1. Oseba → podjetje po matični številki')

  await countQuery(
    'Možnih povezav oseba-podjetje',
    `
    SELECT COUNT(*) 
    FROM osebe o
    JOIN podjetja p
      ON p.maticna = TRIM(o.maticna_podjetja::text)
    WHERE o.maticna_podjetja IS NOT NULL
      AND TRIM(o.maticna_podjetja::text) <> ''
    `
  )

  await insertQuery(
    'Oseba → podjetje',
    `
    INSERT INTO povezave (
      oseba_id,
      podjetje_id,
      oseba2_id,
      podjetje2_id,
      vloga,
      tip_povezave,
      vir
    )
    SELECT
      o.id AS oseba_id,
      p.id AS podjetje_id,
      NULL AS oseba2_id,
      NULL AS podjetje2_id,
      COALESCE(o.tip, 'povezana oseba') AS vloga,
      'oseba-podjetje' AS tip_povezave,
      'osebe.maticna_podjetja' AS vir
    FROM osebe o
    JOIN podjetja p
      ON p.maticna = TRIM(o.maticna_podjetja::text)
    WHERE o.maticna_podjetja IS NOT NULL
      AND TRIM(o.maticna_podjetja::text) <> ''
    ON CONFLICT DO NOTHING
    `
  )
}

async function povezaveProfesorPodjetje() {
  console.log('\n2. Profesor → podjetje po univerzi')

  await countQuery(
    'Možnih povezav profesor-podjetje',
    `
    SELECT COUNT(*)
    FROM profesorji pr
    JOIN osebe o
      ON LOWER(TRIM(o.ime)) = LOWER(TRIM(pr.ime))
     AND LOWER(TRIM(o.priimek)) = LOWER(TRIM(pr.priimek))
    JOIN podjetja p
      ON (
        (pr.univerza ILIKE 'Univerza v Ljubljani'
          AND p.popolno_ime ILIKE '%Univerza v Ljubljani%')
        OR
        (pr.univerza ILIKE 'Univerza v Mariboru'
          AND p.popolno_ime ILIKE '%Univerza v Mariboru%')
        OR
        (pr.univerza ILIKE 'Univerza na Primorskem'
          AND p.popolno_ime ILIKE '%Univerza na Primorskem%')
      )
    WHERE pr.univerza IS NOT NULL
      AND TRIM(pr.univerza) <> ''
    `
  )

  await insertQuery(
    'Profesor → podjetje',
    `
    INSERT INTO povezave (
      oseba_id,
      podjetje_id,
      oseba2_id,
      podjetje2_id,
      vloga,
      tip_povezave,
      vir
    )
    SELECT
      o.id AS oseba_id,
      p.id AS podjetje_id,
      NULL AS oseba2_id,
      NULL AS podjetje2_id,
      'profesor' AS vloga,
      'oseba-podjetje' AS tip_povezave,
      'profesorji.univerza' AS vir
    FROM profesorji pr
    JOIN osebe o
      ON LOWER(TRIM(o.ime)) = LOWER(TRIM(pr.ime))
     AND LOWER(TRIM(o.priimek)) = LOWER(TRIM(pr.priimek))
    JOIN podjetja p
      ON (
        (pr.univerza ILIKE 'Univerza v Ljubljani'
          AND p.popolno_ime ILIKE '%Univerza v Ljubljani%')
        OR
        (pr.univerza ILIKE 'Univerza v Mariboru'
          AND p.popolno_ime ILIKE '%Univerza v Mariboru%')
        OR
        (pr.univerza ILIKE 'Univerza na Primorskem'
          AND p.popolno_ime ILIKE '%Univerza na Primorskem%')
      )
    WHERE pr.univerza IS NOT NULL
      AND TRIM(pr.univerza) <> ''
    ON CONFLICT DO NOTHING
    `
  )
}

async function povezaveOsebaOsebaPoPriimku() {
  console.log('\n3. Oseba → oseba po enakem priimku')

  await countQuery(
    'Možnih povezav oseba-oseba',
    `
    WITH priimki AS (
      SELECT LOWER(TRIM(priimek)) AS priimek
      FROM osebe
      WHERE priimek IS NOT NULL
        AND TRIM(priimek) <> ''
      GROUP BY LOWER(TRIM(priimek))
      HAVING COUNT(*) BETWEEN 2 AND 30
    )
    SELECT COUNT(*)
    FROM osebe o1
    JOIN osebe o2
      ON LOWER(TRIM(o1.priimek)) = LOWER(TRIM(o2.priimek))
     AND o1.id < o2.id
    JOIN priimki pr
      ON pr.priimek = LOWER(TRIM(o1.priimek))
    `
  )

  await insertQuery(
    'Oseba → oseba',
    `
    WITH priimki AS (
      SELECT LOWER(TRIM(priimek)) AS priimek
      FROM osebe
      WHERE priimek IS NOT NULL
        AND TRIM(priimek) <> ''
      GROUP BY LOWER(TRIM(priimek))
      HAVING COUNT(*) BETWEEN 2 AND 30
    )
    INSERT INTO povezave (
      oseba_id,
      oseba2_id,
      podjetje_id,
      podjetje2_id,
      vloga,
      tip_povezave,
      vir
    )
    SELECT
      o1.id AS oseba_id,
      o2.id AS oseba2_id,
      NULL AS podjetje_id,
      NULL AS podjetje2_id,
      'enak priimek' AS vloga,
      'oseba-oseba' AS tip_povezave,
      'avtomatsko: enak priimek' AS vir
    FROM osebe o1
    JOIN osebe o2
      ON LOWER(TRIM(o1.priimek)) = LOWER(TRIM(o2.priimek))
     AND o1.id < o2.id
    JOIN priimki pr
      ON pr.priimek = LOWER(TRIM(o1.priimek))
    ON CONFLICT DO NOTHING
    `
  )
}

async function povezavePodjetjePodjetjePoHseid() {
  console.log('\n4. Podjetje → podjetje po istem HSEID')

  await countQuery(
    'Možnih povezav podjetje-podjetje',
    `
    WITH hseidi AS (
      SELECT hseid
      FROM podjetja
      WHERE hseid IS NOT NULL
        AND TRIM(hseid) <> ''
      GROUP BY hseid
      HAVING COUNT(*) BETWEEN 2 AND 50
    )
    SELECT COUNT(*)
    FROM podjetja p1
    JOIN podjetja p2
      ON p1.hseid = p2.hseid
     AND p1.id < p2.id
    JOIN hseidi h
      ON h.hseid = p1.hseid
    `
  )

  await insertQuery(
    'Podjetje → podjetje',
    `
    WITH hseidi AS (
      SELECT hseid
      FROM podjetja
      WHERE hseid IS NOT NULL
        AND TRIM(hseid) <> ''
      GROUP BY hseid
      HAVING COUNT(*) BETWEEN 2 AND 50
    )
    INSERT INTO povezave (
      oseba_id,
      oseba2_id,
      podjetje_id,
      podjetje2_id,
      vloga,
      tip_povezave,
      vir
    )
    SELECT
      NULL AS oseba_id,
      NULL AS oseba2_id,
      p1.id AS podjetje_id,
      p2.id AS podjetje2_id,
      'isti naslov' AS vloga,
      'podjetje-podjetje' AS tip_povezave,
      'avtomatsko: hseid' AS vir
    FROM podjetja p1
    JOIN podjetja p2
      ON p1.hseid = p2.hseid
     AND p1.id < p2.id
    JOIN hseidi h
      ON h.hseid = p1.hseid
    ON CONFLICT DO NOTHING
    `
  )
}

async function main() {
  try {
    console.log('Začenjam ustvarjanje povezav.')
    console.log('DRY_RUN:', DRY_RUN)

    await povezaveOsebaPodjetjePoMaticni()
    await povezaveProfesorPodjetje()
    await povezaveOsebaOsebaPoPriimku()
    await povezavePodjetjePodjetjePoHseid()

    console.log('\nKončano.')
  } catch (err) {
    console.error('\nNapaka:', err.message)
  } finally {
    await pool.end()
  }
}

main()