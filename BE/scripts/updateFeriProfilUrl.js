require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const axios = require('axios')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// All 48 unique person→profile-URL pairs scraped from ii.feri.um.si/sl/o-institutu/osebje/
// Slug → URL; name derived from slug (two-part slugs only; multi-part = first two)
const PROFILES = [
  'https://ii.feri.um.si/sl/person/aida-kamisalic-latific-1-2/',
  'https://ii.feri.um.si/sl/person/boris-lahovnik/',
  'https://ii.feri.um.si/sl/person/bostjan-brumen-2/',
  'https://ii.feri.um.si/sl/person/bostjan-kezmah/',
  'https://ii.feri.um.si/sl/person/bostjan-sumak/',
  'https://ii.feri.um.si/sl/person/damijan-novak/',
  'https://ii.feri.um.si/sl/person/domen-verber/',
  'https://ii.feri.um.si/sl/person/grega-vrbancic-2/',
  'https://ii.feri.um.si/sl/person/gregor-polancic/',
  'https://ii.feri.um.si/sl/person/ivona-colakovic/',
  'https://ii.feri.um.si/sl/person/jana-jankovic/',
  'https://ii.feri.um.si/sl/person/jani-dugonik/',
  'https://ii.feri.um.si/sl/person/jozsef-gyorkos/',
  'https://ii.feri.um.si/sl/person/katja-kous/',
  'https://ii.feri.um.si/sl/person/lidija-vincekovic/',
  'https://ii.feri.um.si/sl/person/lili-nemec-zlatolas/',
  'https://ii.feri.um.si/sl/person/lucija-brezocnik/',
  'https://ii.feri.um.si/sl/person/luka-cetina/',
  'https://ii.feri.um.si/sl/person/luka-hrgarek/',
  'https://ii.feri.um.si/sl/person/maja-pusnik/',
  'https://ii.feri.um.si/sl/person/maj-perovsek-tribuson/',
  'https://ii.feri.um.si/sl/person/marjan-hericko/',
  'https://ii.feri.um.si/sl/person/marko-holbl/',
  'https://ii.feri.um.si/sl/person/marko-kompara/',
  'https://ii.feri.um.si/sl/person/martin-domajnko/',
  'https://ii.feri.um.si/sl/person/matej-sprogar/',
  'https://ii.feri.um.si/sl/person/mitja-gradisnik/',
  'https://ii.feri.um.si/sl/person/muhamed-turkanovic/',
  'https://ii.feri.um.si/sl/person/nadica-uzunova/',
  'https://ii.feri.um.si/sl/person/nika-jersic/',
  'https://ii.feri.um.si/sl/person/patrik-rek/',
  'https://ii.feri.um.si/sl/person/sasa-brdnik/',
  'https://ii.feri.um.si/sl/person/sasa-kuhar/',
  'https://ii.feri.um.si/sl/person/saso-karakatic',
  'https://ii.feri.um.si/sl/person/spela-cucko/',
  'https://ii.feri.um.si/sl/person/spela-pecnik/',
  'https://ii.feri.um.si/sl/person/stanislav-moraus/',
  'https://ii.feri.um.si/sl/person/tadej-lahovnik/',
  'https://ii.feri.um.si/sl/person/tatjana-welzer/',
  'https://ii.feri.um.si/sl/person/tilen-hlis/',
  'https://ii.feri.um.si/sl/person/tilen-tratnjek/',
  'https://ii.feri.um.si/sl/person/tina-beranic/',
  'https://ii.feri.um.si/sl/person/tjasa-hericko/',
  'https://ii.feri.um.si/sl/person/vasilka-saklamaeva/',
  'https://ii.feri.um.si/sl/person/vid-kersic/',
  'https://ii.feri.um.si/sl/person/viktor-taneski/',
  'https://ii.feri.um.si/sl/person/vili-podgorelec/',
  'https://ii.feri.um.si/sl/person/zala-lahovnik/',
]

// Normalize: remove diacritics, lowercase
function norm(s) {
  return s.toLowerCase()
    .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd')
    .replace(/á|à|â|ä/g, 'a').replace(/é|è|ê/g, 'e').replace(/í|ì/g, 'i')
    .replace(/ó|ò|ô/g, 'o').replace(/ú|ù|û/g, 'u').replace(/ő/g, 'o').replace(/ü/g, 'u')
}

// Derive first name + last name from URL slug
function namesFromSlug(url) {
  const slug = url.replace(/.*\/person\//, '').replace(/\/$/, '').replace(/-\d+$/, '')
  const parts = slug.split('-')
  // Slug format: firstname-lastname (sometimes lastname-part2 for compound surnames)
  // Return first part as ime, rest joined as priimek
  if (parts.length < 2) return null
  return { ime: parts[0], priimek: parts.slice(1).join('') }
}

async function findPersonBySlug(slugName) {
  const { ime, priimek } = slugName
  const ni = norm(ime), np = norm(priimek)

  // Try normalized match in DB
  const r = await pool.query(`
    SELECT id, ime, priimek, profil_url FROM osebe
    WHERE translate(LOWER(ime),'čćšžđáàâäéèêíìóòôúùûőü','ccszddaaaaeeeiiooouuuou') LIKE $1
      AND translate(LOWER(priimek),'čćšžđáàâäéèêíìóòôúùûőü','ccszddaaaaeeeiiooouuuou') LIKE $2
    LIMIT 5
  `, [`%${ni}%`, `${np}%`])

  if (r.rows.length) return r.rows[0]

  // Try reversed (some slugs put surname first)
  const r2 = await pool.query(`
    SELECT id, ime, priimek, profil_url FROM osebe
    WHERE translate(LOWER(ime),'čćšžđáàâäéèêíìóòôúùûőü','ccszddaaaaeeeiiooouuuou') LIKE $1
      AND translate(LOWER(priimek),'čćšžđáàâäéèêíìóòôúùûőü','ccszddaaaaeeeiiooouuuou') LIKE $2
    LIMIT 5
  `, [`%${np}%`, `${ni}%`])

  return r2.rows[0] || null
}

async function main() {
  let updated = 0, notFound = 0, skipped = 0

  for (const url of PROFILES) {
    const slugName = namesFromSlug(url)
    if (!slugName) { console.log(`SKIP (bad slug): ${url}`); skipped++; continue }

    const person = await findPersonBySlug(slugName)
    if (!person) {
      console.log(`NOT FOUND: ${slugName.ime} ${slugName.priimek} (${url})`)
      notFound++
      continue
    }

    if (person.profil_url === url) {
      console.log(`OK (same): ${person.ime} ${person.priimek}`)
      skipped++
      continue
    }

    await pool.query('UPDATE osebe SET profil_url = $1 WHERE id = $2', [url, person.id])
    console.log(`UPDATED: ${person.ime} ${person.priimek} → ${url}`)
    updated++
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found, ${skipped} skipped`)
  await pool.end()
}

main().catch(e => { console.error(e); pool.end() })
