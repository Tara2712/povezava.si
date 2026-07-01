const axios = require('axios')

const normStr = (s) => s.toLowerCase().replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd')

const stemStr = (s) => {
  const n = normStr(s)
  if (n.length <= 4) return n
  return n.slice(0, n.length - 2)
}

const PERSON_SELECT = `
  SELECT o.id, o.ime, o.priimek, o.tip, o.opis, o.institucija, o.profil_url,
    JSON_AGG(JSON_BUILD_OBJECT('podjetje', d.popolno_ime, 'vloga', p.vloga))
      FILTER (WHERE d.id IS NOT NULL) AS povezave
  FROM osebe o
  LEFT JOIN povezave p ON p.oseba_id = o.id
  LEFT JOIN podjetja d ON d.id = p.podjetje_id`

function personSummary(o) {
  const topConn = (o.povezave || []).slice(0, 5).map(p => `${p.podjetje} (${p.vloga})`).join('; ') || 'ni podatka'
  return [
    `Ime: ${o.ime} ${o.priimek}`,
    `Tip: ${o.tip || 'ni podatka'}`,
    `Institucija: ${o.institucija || 'ni podatka'}`,
    `Opis/vloga: ${o.opis || 'ni podatka'}`,
    `Skupaj poslovnih povezav: ${o.povezave?.length || 0}`,
    o.povezave?.length ? `Nekatere organizacije: ${topConn}` : ''
  ].filter(Boolean).join('\n')
}

async function lookupPersonInDB(nameStr, pool) {
  const parts = nameStr.trim().split(/\s+/)
  if (parts.length < 2) return null
  try {
    const [p1, p2] = parts
    const [n1, n2] = [normStr(p1), normStr(p2)]
    const [s1, s2] = [stemStr(p1), stemStr(p2)]

    // Attempt 1: exact + translate match
    let r = await pool.query(`${PERSON_SELECT}
      WHERE (o.ime ILIKE $1 AND o.priimek ILIKE $2) OR (o.ime ILIKE $2 AND o.priimek ILIKE $1)
         OR (translate(LOWER(o.ime),'čćšžđ','ccszd') ILIKE $3 AND translate(LOWER(o.priimek),'čćšžđ','ccszd') ILIKE $4)
         OR (translate(LOWER(o.ime),'čćšžđ','ccszd') ILIKE $4 AND translate(LOWER(o.priimek),'čćšžđ','ccszd') ILIKE $3)
      GROUP BY o.id LIMIT 3
    `, [`%${p1}%`, `%${p2}%`, `%${n1}%`, `%${n2}%`])

    // Attempt 2: stem prefix search
    if (!r.rows.length) {
      r = await pool.query(`${PERSON_SELECT}
        WHERE (translate(LOWER(o.ime),'čćšžđ','ccszd') LIKE $1 AND translate(LOWER(o.priimek),'čćšžđ','ccszd') LIKE $2)
           OR (translate(LOWER(o.ime),'čćšžđ','ccszd') LIKE $2 AND translate(LOWER(o.priimek),'čćšžđ','ccszd') LIKE $1)
        GROUP BY o.id LIMIT 3
      `, [`${s1}%`, `${s2}%`])
    }

    // Attempt 3: consonant-skeleton match
    if (!r.rows.length) {
      const cskel = (s) => normStr(s).replace(/[aeiou]/g, '')
      const c1 = cskel(p1), c2 = cskel(p2)
      if (c1.length >= 3 && c2.length >= 3) {
        r = await pool.query(`${PERSON_SELECT}
          WHERE (regexp_replace(translate(LOWER(o.ime),'čćšžđ','ccszd'),'[aeiou]','','g') LIKE $1
                 AND regexp_replace(translate(LOWER(o.priimek),'čćšžđ','ccszd'),'[aeiou]','','g') LIKE $2)
              OR (regexp_replace(translate(LOWER(o.ime),'čćšžđ','ccszd'),'[aeiou]','','g') LIKE $2
                 AND regexp_replace(translate(LOWER(o.priimek),'čćšžđ','ccszd'),'[aeiou]','','g') LIKE $1)
          GROUP BY o.id LIMIT 3
        `, [`${c1}%`, `${c2}%`])
      }
    }

    if (!r.rows.length) return null
    const o = r.rows[0]
    return { osebe: r.rows, summary: personSummary(o) }
  } catch { return null }
}

async function searchWeb(query) {
  if (!process.env.TAVILY_API_KEY) return null
  try {
    const resp = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: query + ' Slovenija',
      search_depth: 'basic',
      max_results: 4,
      include_answer: true
    }, { timeout: 8000 })
    const answer = resp.data.answer || ''
    const snippets = (resp.data.results || [])
      .map(r => `[${r.title}]: ${r.content?.slice(0, 300)}`)
      .join('\n')
    return [answer, snippets].filter(Boolean).join('\n\n').slice(0, 2000)
  } catch (e) {
    console.warn('Tavily napaka:', e.message)
    return null
  }
}

async function fetchProfilData(url) {
  if (!url) return null
  try {
    const resp = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } })
    let html = resp.data

    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')

    html = html
      .replace(/<h[1-6][^>]*>/gi, '\n### ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/li>/gi, '')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|section|article|td|tr)[^>]*>/gi, '\n')
      .replace(/<a[^>]*href="mailto:([^"]+)"[^>]*>/gi, (_, email) => email + ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    const PROFILE_SECTIONS = /Kontakt|Izobrazba|Zaposlitev|Področja|Projekti|Mednarodni|Bibliografija|Nagrade|Mentorstvo/i
    const startIdx = html.search(PROFILE_SECTIONS)
    if (startIdx > 50) html = html.slice(startIdx)

    return html.slice(0, 3500).trim()
  } catch (e) {
    console.warn('Scraping napaka:', e.message)
    return null
  }
}

module.exports = {
  normStr,
  stemStr,
  PERSON_SELECT,
  personSummary,
  lookupPersonInDB,
  searchWeb,
  fetchProfilData
}