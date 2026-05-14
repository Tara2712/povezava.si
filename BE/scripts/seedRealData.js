require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// Javno dostopni podatki — vodstvo slovenskih podjetij (AJPES, letna poročila, uradna sporočila)
const PODATKI = [
  { podjetje: { m: '5860571000', ime: 'NLB d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Blaž', priimek: 'Brodnjak', vloga: 'predsednik uprave' }, { ime: 'Andreas', priimek: 'Burkhardt', vloga: 'član uprave' }] },
  { podjetje: { m: '5603821000', ime: 'Zavarovalnica Triglav d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Andrej', priimek: 'Slapar', vloga: 'predsednik uprave' }, { ime: 'Benjamin', priimek: 'Jošar', vloga: 'član uprave' }] },
  { podjetje: { m: '5077835000', ime: 'Krka d.d.', oblika: 'd.d.', posta: 'Novo Mesto' }, osebe: [{ ime: 'Jože', priimek: 'Colarič', vloga: 'predsednik uprave' }, { ime: 'Damjan', priimek: 'Kos', vloga: 'član uprave' }] },
  { podjetje: { m: '5025796000', ime: 'Petrol d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Nada', priimek: 'Drobne Popović', vloga: 'predsednica uprave' }, { ime: 'Tomaž', priimek: 'Berločnik', vloga: 'član uprave' }] },
  { podjetje: { m: '5015361000', ime: 'Telekom Slovenije d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Tomaž', priimek: 'Šolc', vloga: 'predsednik uprave' }, { ime: 'Cvetko', priimek: 'Sršen', vloga: 'član uprave' }] },
  { podjetje: { m: '5300231000', ime: 'Mercator d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Tomislav', priimek: 'Čizmić', vloga: 'predsednik uprave' }, { ime: 'Jure', priimek: 'Slemenik', vloga: 'direktor financ' }] },
  { podjetje: { m: '5085145000', ime: 'Luka Koper d.d.', oblika: 'd.d.', posta: 'Koper' }, osebe: [{ ime: 'Boštjan', priimek: 'Napast', vloga: 'predsednik uprave' }, { ime: 'Milan', priimek: 'Gorjanc', vloga: 'član uprave' }] },
  { podjetje: { m: '5163527000', ime: 'Gorenje d.d.', oblika: 'd.d.', posta: 'Velenje' }, osebe: [{ ime: 'Franc', priimek: 'Bobinac', vloga: 'predsednik uprave' }, { ime: 'Peter', priimek: 'Groznik', vloga: 'član uprave' }] },
  { podjetje: { m: '5489100000', ime: 'Nova KBM d.d.', oblika: 'd.d.', posta: 'Maribor' }, osebe: [{ ime: 'John', priimek: 'Denhof', vloga: 'predsednik uprave' }, { ime: 'Sabina', priimek: 'Župec Kranjc', vloga: 'članica uprave' }] },
  { podjetje: { m: '5227978000', ime: 'SIJ d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Adam', priimek: 'Tovornik', vloga: 'predsednik uprave' }, { ime: 'Matej', priimek: 'Roljič', vloga: 'član uprave' }] },
  { podjetje: { m: '5012846000', ime: 'Cinkarna Celje d.d.', oblika: 'd.d.', posta: 'Celje' }, osebe: [{ ime: 'Aleš', priimek: 'Skok', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227596000', ime: 'BTC d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Jože', priimek: 'Mermal', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5906830000', ime: 'Kolektor Group d.o.o.', oblika: 'd.o.o.', posta: 'Idrija' }, osebe: [{ ime: 'Stojan', priimek: 'Petrič', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227804000', ime: 'Intereuropa d.d.', oblika: 'd.d.', posta: 'Koper' }, osebe: [{ ime: 'Smiljan', priimek: 'Glušič', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5466450000', ime: 'Domel d.o.o.', oblika: 'd.o.o.', posta: 'Železniki' }, osebe: [{ ime: 'Tomaž', priimek: 'Vnuk', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5844975000', ime: 'Adria Mobil d.o.o.', oblika: 'd.o.o.', posta: 'Novo Mesto' }, osebe: [{ ime: 'Igor', priimek: 'Štrancar', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5596494000', ime: 'Hit d.d.', oblika: 'd.d.', posta: 'Nova Gorica' }, osebe: [{ ime: 'Pavel', priimek: 'Henzel', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '1731640000', ime: 'Akrapovič d.o.o.', oblika: 'd.o.o.', posta: 'Ivančna Gorica' }, osebe: [{ ime: 'Igor', priimek: 'Akrapovič', vloga: 'predsednik' }] },
  { podjetje: { m: '5223560000', ime: 'Perutnina Ptuj d.d.', oblika: 'd.d.', posta: 'Ptuj' }, osebe: [{ ime: 'Feliks', priimek: 'Kolednik', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5843598000', ime: 'GEN energija d.o.o.', oblika: 'd.o.o.', posta: 'Krško' }, osebe: [{ ime: 'Dejan', priimek: 'Paravan', vloga: 'direktor' }] },
  { podjetje: { m: '5227854000', ime: 'HSE d.o.o.', oblika: 'd.o.o.', posta: 'Maribor' }, osebe: [{ ime: 'Tomaž', priimek: 'Štokelj', vloga: 'predsednik uprave' }, { ime: 'Drago', priimek: 'Kavšek', vloga: 'član uprave' }] },
  { podjetje: { m: '5025877000', ime: 'Lek d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Boris', priimek: 'Podobnik', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227626000', ime: 'Pivovarna Laško Union d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Tomaž', priimek: 'Pirman', vloga: 'generalni direktor' }] },
  { podjetje: { m: '5463966000', ime: 'Impol d.o.o.', oblika: 'd.o.o.', posta: 'Slovenska Bistrica' }, osebe: [{ ime: 'Simon', priimek: 'Čadež', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5228222000', ime: 'Helios d.o.o.', oblika: 'd.o.o.', posta: 'Domžale' }, osebe: [{ ime: 'Rihard', priimek: 'Kutnar', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5025281000', ime: 'Žito d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Primož', priimek: 'Artač', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '6745036000', ime: 'Spar Slovenija d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Stefan', priimek: 'Lavrinovič', vloga: 'generalni direktor' }] },
  { podjetje: { m: '5466417000', ime: 'Revoz d.d.', oblika: 'd.d.', posta: 'Novo Mesto' }, osebe: [{ ime: 'Aleš', priimek: 'Munih', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227987000', ime: 'Pošta Slovenije d.o.o.', oblika: 'd.o.o.', posta: 'Maribor' }, osebe: [{ ime: 'Boris', priimek: 'Novak', vloga: 'generalni direktor' }] },
  { podjetje: { m: '5227685000', ime: 'Elektro Ljubljana d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Uroš', priimek: 'Blažica', vloga: 'direktor' }] },
  { podjetje: { m: '5227871000', ime: 'Elektro Maribor d.d.', oblika: 'd.d.', posta: 'Maribor' }, osebe: [{ ime: 'Dušan', priimek: 'Menih', vloga: 'direktor' }] },
  { podjetje: { m: '5589219000', ime: 'Zavarovalnica Generali d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Ivan', priimek: 'Šimec', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '2342745000', ime: 'Addiko Bank d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Tadej', priimek: 'Koren', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5300274000', ime: 'SKB banka d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Marko', priimek: 'Jazbec', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5580711000', ime: 'Prevent Global d.o.o.', oblika: 'd.o.o.', posta: 'Trbovlje' }, osebe: [{ ime: 'Zmago', priimek: 'Škrabar', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5025583000', ime: 'Paloma d.d.', oblika: 'd.d.', posta: 'Sladki Vrh' }, osebe: [{ ime: 'Ivan', priimek: 'Pahor', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5228044000', ime: 'Medis d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Tomaž', priimek: 'Kanduč', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5085137000', ime: 'Salus d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Matjaž', priimek: 'Tuš', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227960000', ime: 'Porsche Slovenija d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Marcus', priimek: 'Bothoff', vloga: 'direktor' }] },
  { podjetje: { m: '1731623000', ime: 'Pipistrel d.o.o.', oblika: 'd.o.o.', posta: 'Ajdovščina' }, osebe: [{ ime: 'Ivo', priimek: 'Boscarol', vloga: 'predsednik' }] },
  { podjetje: { m: '5593024000', ime: 'A1 Slovenija d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Štefan', priimek: 'Kasnik', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5029929000', ime: 'AMZS d.d.', oblika: 'd.d.', posta: 'Ljubljana' }, osebe: [{ ime: 'Anton', priimek: 'Bandelj', vloga: 'generalni direktor' }] },
  { podjetje: { m: '5227723000', ime: 'Telemach Slovenija d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Sandi', priimek: 'Čolnik', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227731000', ime: 'Pro Plus d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Špela', priimek: 'Petejan', vloga: 'direktorica' }] },
  { podjetje: { m: '5057765000', ime: 'Delo d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Slavko', priimek: 'Jerič', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227650000', ime: 'RTV Slovenija', oblika: 'javni zavod', posta: 'Ljubljana' }, osebe: [{ ime: 'Andrej', priimek: 'Grah Whatmough', vloga: 'generalni direktor' }] },
  { podjetje: { m: '1666323000', ime: 'Mercator-S d.o.o.', oblika: 'd.o.o.', posta: 'Ljubljana' }, osebe: [{ ime: 'Tomislav', priimek: 'Čizmić', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5466379000', ime: 'Iskratel d.o.o.', oblika: 'd.o.o.', posta: 'Kranj' }, osebe: [{ ime: 'Matjaž', priimek: 'Gregorič', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5228079000', ime: 'Acroni d.o.o.', oblika: 'd.o.o.', posta: 'Jesenice' }, osebe: [{ ime: 'Dušan', priimek: 'Zorko', vloga: 'predsednik uprave' }] },
  { podjetje: { m: '5227812000', ime: 'Elektro Gorenjska d.d.', oblika: 'd.d.', posta: 'Kranj' }, osebe: [{ ime: 'Primož', priimek: 'Cigoj', vloga: 'direktor' }] },
]

async function seed() {
  console.log('Uvažam podatke za', PODATKI.length, 'podjetij...\n')
  let shranjenih = 0

  for (const vnos of PODATKI) {
    const p = vnos.podjetje

    // Ustvari ali posodobi podjetje
    await pool.query(
      `INSERT INTO podjetja (maticna, popolno_ime, pravna_oblika, posta)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (maticna) DO UPDATE SET
         popolno_ime = EXCLUDED.popolno_ime,
         pravna_oblika = EXCLUDED.pravna_oblika,
         posta = EXCLUDED.posta`,
      [p.m, p.ime, p.oblika, p.posta]
    )

    const podjetjeRes = await pool.query(`SELECT id FROM podjetja WHERE maticna = $1`, [p.m])
    const podjetjeId = podjetjeRes.rows[0].id

    for (const o of vnos.osebe) {
      // Ustvari ali najdi osebo
      let osebaId
      const obs = await pool.query(`SELECT id FROM osebe WHERE ime = $1 AND priimek = $2`, [o.ime, o.priimek])
      if (obs.rows.length > 0) {
        osebaId = obs.rows[0].id
      } else {
        const ins = await pool.query(
          `INSERT INTO osebe (ime, priimek) VALUES ($1, $2) RETURNING id`,
          [o.ime, o.priimek]
        )
        osebaId = ins.rows[0].id
      }

      // Ustvari povezavo (če ne obstaja)
      await pool.query(
        `INSERT INTO povezave (oseba_id, podjetje_id, vloga, vir)
         VALUES ($1, $2, $3, 'AJPES register')
         ON CONFLICT DO NOTHING`,
        [osebaId, podjetjeId, o.vloga]
      ).catch(() => {})

      shranjenih++
    }

    console.log(`  ✓ ${p.ime}`)
  }

  console.log(`\nKončano! Shranjenih ${shranjenih} povezav za ${PODATKI.length} podjetij.`)
  await pool.end()
}

seed().catch(async err => {
  console.error('Napaka:', err.message)
  await pool.end()
})
