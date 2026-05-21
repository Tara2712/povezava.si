require('dotenv').config()
const neo4j = require('neo4j-driver')
const { Pool } = require('pg')

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function uvozi() {
  const session = driver.session()

  try {
    // Počisti obstoječe podatke
    console.log('Brišem stare podatke...')
    await session.run('MATCH (n) DETACH DELETE n')

    // Uvozi podjetja -tabelo
    console.log('Uvažam podjetja...')
    const podjetja = await pool.query(`
      SELECT id, maticna, popolno_ime, posta, pravna_oblika 
      FROM podjetja 
    `)

    for (const p of podjetja.rows) {
      await session.run(`
        MERGE (p:Podjetje {maticna: $maticna})
        SET p.naziv = $naziv,
            p.posta = $posta,
            p.pravna_oblika = $pravna_oblika,
            p.db_id = $db_id
      `, {
        maticna: p.maticna,
        naziv: p.popolno_ime || '',
        posta: p.posta || '',
        pravna_oblika: p.pravna_oblika || '',
        db_id: p.id.toString()
      })
    }
    console.log(`Uvoženih ${podjetja.rows.length} podjetij`)

    // Uvozi osebe - tabelo
    console.log('Uvažam osebe...')
    const osebe = await pool.query(`
      SELECT id, ime, priimek, regija
      FROM osebe
    `)

    for (const o of osebe.rows) {
      await session.run(`
        MERGE (o:Oseba {db_id: $id})
        SET o.ime = $ime,
            o.priimek = $priimek,
            o.regija = $regija
      `, {
        id: o.id.toString(),
        ime: o.ime || '',
        priimek: o.priimek || '',
        regija: o.regija || ''
      })
    }
    console.log(`Uvoženih ${osebe.rows.length} oseb`)

    // Uvozi povezave - tabelo
    console.log('Uvažam povezave...')
    const povezave = await pool.query(`
      SELECT p.oseba_id, p.podjetje_id, p.vloga, p.delez,
             pod.maticna
      FROM povezave p
      JOIN podjetja pod ON p.podjetje_id = pod.id
      WHERE p.oseba_id IS NOT NULL AND p.podjetje_id IS NOT NULL
    `)

    for (const l of povezave.rows) {
      await session.run(`
        MATCH (o:Oseba {db_id: $osebaId})
        MATCH (p:Podjetje {maticna: $maticna})
        MERGE (o)-[r:POVEZAN_Z]->(p)
        SET r.vloga = $vloga,
            r.delez = $delez
      `, {
        osebaId: l.oseba_id.toString(),
        maticna: l.maticna,
        vloga: l.vloga || '',
        delez: l.delez ? l.delez.toString() : '0'
      })
    }
    console.log(`Uvoženih ${povezave.rows.length} povezav`)

    // rezultat
    const stPodjetij = await session.run('MATCH (p:Podjetje) RETURN count(p) AS st')
    const stOseb = await session.run('MATCH (o:Oseba) RETURN count(o) AS st')
    const stPovezav = await session.run('MATCH ()-[r]->() RETURN count(r) AS st')

    console.log(`\nNeo4j vsebuje:`)
    console.log(`Podjetij: ${stPodjetij.records[0].get('st')}`)
    console.log(`Oseb: ${stOseb.records[0].get('st')}`)
    console.log(`Povezav: ${stPovezav.records[0].get('st')}`)

  } catch (err) {
    console.error('Napaka:', err.message)
  } finally {
    await session.close()
    await driver.close()
    await pool.end()
  }
}

uvozi()