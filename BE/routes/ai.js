const express = require('express')
const OpenAI = require('openai')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const {
  lookupPersonInDB,
  searchWeb,
  fetchProfilData,
  normStr,
  stemStr
} = require('../utils/dbHelpers')

module.exports = (pool) => {
  const router = express.Router()

  // ── Tool implementations ────────────────────────────────────────────────────

  async function toolLookupPerson(name) {
    const result = await lookupPersonInDB(name, pool)
    if (!result) return { found: false, message: `Oseba "${name}" ni v bazi Povezava.si.`, osebe: null }
    return { found: true, osebe: result.osebe, message: result.summary }
  }

  async function toolGetStats() {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM osebe) AS osebe,
        (SELECT COUNT(*) FROM podjetja) AS podjetja,
        (SELECT COUNT(*) FROM povezave) AS povezave
    `)
    const s = r.rows[0]
    return `V bazi je ${s.osebe} oseb, ${s.podjetja} podjetij in ${s.povezave} poslovnih povezav.`
  }

  async function toolGetCompanyStaff(company) {
    const stem = company.length > 4 ? company.replace(/[aeiouAEIOU]$/, '') : company
    const r = await pool.query(`
      SELECT o.id, o.ime, o.priimek, p.vloga, d.popolno_ime AS podjetje
      FROM osebe o JOIN povezave p ON p.oseba_id=o.id JOIN podjetja d ON d.id=p.podjetje_id
      WHERE d.popolno_ime ILIKE $1 OR d.popolno_ime ILIKE $2
      ORDER BY p.vloga LIMIT 12
    `, [`%${company}%`, `%${stem}%`])
    if (!r.rows.length) return `Podjetje "${company}" ni najdeno v bazi.`
    return `${r.rows[0].podjetje}: ${r.rows.map(o => `${o.ime} ${o.priimek} (${o.vloga})`).join(', ')}`
  }

  async function toolGetTopConnected(limit = 5) {
    const n = parseInt(limit) || 5
    const r = await pool.query(`
      SELECT o.id, o.ime, o.priimek, COUNT(p.id) AS n
      FROM osebe o JOIN povezave p ON p.oseba_id=o.id
      GROUP BY o.id ORDER BY n DESC LIMIT $1
    `, [n])
    return r.rows.map((o, i) => `${i + 1}. ${o.ime} ${o.priimek} — ${o.n} povezav`).join('\n')
  }

  async function toolGetLobists() {
    const r = await pool.query(`SELECT COUNT(*) AS n FROM lobisti_info WHERE datum_izpisa IS NULL`)
    const sample = await pool.query(`
      SELECT o.ime, o.priimek, l.delodajalec, l.narocnik
      FROM lobisti_info l JOIN osebe o ON o.id = l.oseba_id
      WHERE l.datum_izpisa IS NULL ORDER BY l.datum_vpisa DESC LIMIT 5
    `)
    const seznam = sample.rows.map(l => `${l.ime} ${l.priimek} (${l.delodajalec || l.narocnik || ''})`).join(', ')
    return `V registru je ${r.rows[0].n} aktivnih lobistov. Nekateri: ${seznam}.`
  }

  async function toolSearchAkademiki() {
    const r = await pool.query(`
      SELECT id, ime, priimek, opis, institucija FROM osebe
      WHERE tip = 'akademik' ORDER BY priimek LIMIT 10
    `)
    return r.rows.map(o => `${o.ime} ${o.priimek} — ${o.institucija || o.opis || ''}`).join('\n')
  }

  async function toolSearchPersons(keyword) {
    const kw = `%${keyword}%`
    let r = await pool.query(`
      SELECT id, ime, priimek, tip, institucija, opis FROM osebe
      WHERE opis ILIKE $1 OR institucija ILIKE $1 OR CONCAT(ime,' ',priimek) ILIKE $1
      ORDER BY tip, priimek LIMIT 12
    `, [kw])

    if (!r.rows.length) {
      const words = keyword.split(/\s+/).filter(w => w.length > 3).map(w => normStr(w).slice(0, -1))
      if (words.length) {
        const conditions = words.map((_, i) =>
          `(translate(LOWER(opis),'čćšžđ','ccszd') ILIKE $${i+1} OR translate(LOWER(institucija),'čćšžđ','ccszd') ILIKE $${i+1})`
        ).join(' OR ')
        r = await pool.query(
          `SELECT id, ime, priimek, tip, institucija, opis FROM osebe WHERE ${conditions} ORDER BY tip, priimek LIMIT 12`,
          words.map(w => `%${w}%`)
        )
      }
    }

    if (!r.rows.length) return `Ni oseb za iskanje "${keyword}".`
    return r.rows.map(o => `${o.ime} ${o.priimek} — ${o.tip || ''}, ${o.institucija || o.opis || ''}`).join('\n')
  }

  async function toolComparePersons(name1, name2) {
    const [res1, res2] = await Promise.all([
      lookupPersonInDB(name1, pool),
      lookupPersonInDB(name2, pool)
    ])
    if (!res1) return `Oseba "${name1}" ni v bazi.`
    if (!res2) return `Oseba "${name2}" ni v bazi.`
    const [o1, o2] = [res1.osebe[0], res2.osebe[0]]
    const r = await pool.query(`
      SELECT d.popolno_ime, p1.vloga AS vloga1, p2.vloga AS vloga2
      FROM povezave p1
      JOIN povezave p2 ON p2.podjetje_id = p1.podjetje_id AND p2.oseba_id = $2
      JOIN podjetja d ON d.id = p1.podjetje_id
      WHERE p1.oseba_id = $1 LIMIT 10
    `, [o1.id, o2.id])
    if (!r.rows.length) {
      return `${o1.ime} ${o1.priimek} (${o1.tip}, ${o1.institucija || ''}) in ${o2.ime} ${o2.priimek} (${o2.tip}, ${o2.institucija || ''}) nimata skupnih organizacij v bazi.`
    }
    const skupne = r.rows.map(row => `${row.popolno_ime} — ${o1.ime}: ${row.vloga1}, ${o2.ime}: ${row.vloga2}`).join('\n')
    return `${o1.ime} ${o1.priimek} in ${o2.ime} ${o2.priimek} sta skupaj v ${r.rows.length} organizacijah:\n${skupne}`
  }

  async function toolGetPersonArticles(name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length < 2) return 'Ni dovolj podatkov za iskanje.'

    const found = await lookupPersonInDB(name, pool)
    const canonicalName = found ? `${found.osebe[0].ime} ${found.osebe[0].priimek}` : name
    const canonParts = canonicalName.trim().split(/\s+/)
    const [p1, p2] = canonParts.length >= 2 ? canonParts : parts
    const n1 = normStr(p1), n2 = normStr(p2)

    let r = await pool.query(`
      SELECT c.naslov, c.url, c.datum, c.vir
      FROM clanki c
      JOIN clanki_osebe co ON co.clanek_id = c.id
      JOIN osebe o ON o.id = co.oseba_id
      WHERE (o.ime ILIKE $1 AND o.priimek ILIKE $2) OR (o.ime ILIKE $2 AND o.priimek ILIKE $1)
         OR (translate(LOWER(o.ime),'čćšžđ','ccszd') ILIKE $3 AND translate(LOWER(o.priimek),'čćšžđ','ccszd') ILIKE $4)
      ORDER BY c.datum DESC LIMIT 5
    `, [`%${p1}%`, `%${p2}%`, `%${n1}%`, `%${n2}%`])

    if (!r.rows.length) {
      const [s1, s2] = [stemStr(p1), stemStr(p2)]
      r = await pool.query(`
        SELECT naslov, url, datum, vir FROM clanki
        WHERE (naslov ILIKE $1 OR naslov ILIKE $2)
           OR (translate(LOWER(naslov),'čćšžđ','ccszd') LIKE $3 AND translate(LOWER(naslov),'čćšžđ','ccszd') LIKE $4)
           OR (translate(LOWER(naslov),'čćšžđ','ccszd') LIKE $4 AND translate(LOWER(naslov),'čćšžđ','ccszd') LIKE $3)
        ORDER BY datum DESC LIMIT 5
      `, [`%${p1}%${p2}%`, `%${p2}%${p1}%`, `${s1}%`, `${s2}%`])
    }

    if (!r.rows.length) return `Za osebo "${name}" ni člankov v bazi.`
    return r.rows.map((c, i) =>
      `${i + 1}. [${c.naslov}](${c.url}) — ${c.vir}, ${new Date(c.datum).toLocaleDateString('sl-SI')}`
    ).join('\n')
  }

  async function toolGetFeriProfile(name) {
    const result = await lookupPersonInDB(name, pool)
    if (!result) return `Oseba "${name}" ni v bazi Povezava.si.`
    const o = result.osebe[0]
    if (o.tip !== 'akademik') return `${o.ime} ${o.priimek} ni akademik v bazi — ni FERI profila.`
    if (!o.profil_url) return `${o.ime} ${o.priimek} nima profil URL-ja v bazi.`
    const dbProfil = await pool.query('SELECT feri_profil_text FROM osebe WHERE id=$1', [o.id])
    const data = dbProfil.rows[0]?.feri_profil_text || await fetchProfilData(o.profil_url)
    if (!data) return `Ni mogoče pridobiti profila ${o.ime} ${o.priimek}.`
    return `FERI profil — ${o.ime} ${o.priimek}:\n\n${data}`
  }

  // ── Tool definitions ────────────────────────────────────────────────────────

  const AI_TOOLS = [
    {
      type: 'function',
      function: {
        name: 'lookup_person',
        description: 'Poišči osebo v bazi Povezava.si po imenu in priimku. Uporabi za VSA vprašanja o specifični osebi (kdo je, kje dela, profil, projekti, itd.).',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string', description: 'Ime in priimek, npr. "Marjan Heričko" ali "Domen Verber"' } },
          required: ['name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_database_stats',
        description: 'Pridobi statistike baze: koliko oseb, podjetij in poslovnih povezav je v Povezava.si.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_company_staff',
        description: 'Poišči osebe ki delajo ali so delali v določenem podjetju ali organizaciji.',
        parameters: {
          type: 'object',
          properties: { company: { type: 'string', description: 'Ime podjetja, npr. "Petrol", "NLB", "Telekom"' } },
          required: ['company']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_top_connected',
        description: 'Pridobi seznam oseb z največ poslovnimi povezavami v bazi.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'string', description: 'Koliko rezultatov (privzeto 5)' } }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_lobists',
        description: 'Pridobi informacije o lobistih v registru.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_akademiki',
        description: 'Pridobi seznam akademikov (profesorjev) iz baze, zlasti z UM FERI.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_persons',
        description: 'Poišči osebe po ključni besedi, opisu, instituciji ali imenu.',
        parameters: {
          type: 'object',
          properties: { keyword: { type: 'string', description: 'Iskalna beseda ali fraza' } },
          required: ['keyword']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'compare_persons',
        description: 'Primerjaj dve osebi — poišči skupne organizacije in povezave.',
        parameters: {
          type: 'object',
          properties: {
            name1: { type: 'string', description: 'Ime in priimek prve osebe' },
            name2: { type: 'string', description: 'Ime in priimek druge osebe' }
          },
          required: ['name1', 'name2']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_person_articles',
        description: 'Pridobi zadnje novičarske članke o določeni osebi iz baze.',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string', description: 'Ime in priimek osebe' } },
          required: ['name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_web',
        description: 'Poišči informacije na spletu. Uporabi ko oseba ali podjetje NI v bazi.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Iskalni niz za spletno iskanje' } },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_feri_profile',
        description: 'Pridobi podroben FERI profil akademika — kontakt, izobrazba, zaposlitev, projekti.',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string', description: 'Ime in priimek akademika' } },
          required: ['name']
        }
      }
    }
  ]

  // ── POST /ai/vprasaj ────────────────────────────────────────────────────────

  router.post('/vprasaj', async (req, res) => {
    const { vprasanje, history } = req.body
    if (!vprasanje?.trim()) return res.status(400).json({ error: 'Manjka vprašanje' })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    const emit = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

    try {
      const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })

      const SYSTEM = `Si profesionalni AI asistent za Povezava.si — slovensko bazo poslovnih in akademskih mrež.

Pravila:
- Odgovarjaj v slovenščini, jedrnat in naraven jezik.
- Seznam (področja, izobrazba, projekti, kontakt) VEDNO prikaži kot bullet točke z "-", ne v odstavku.
- Ko te prosijo za link/profil: odgovori samo "Profil je prikazan spodaj."
- Ko oseba ni v bazi + imaš spletne info: povzemi splet, napomni da ni v bazi.
- Ne izmišljaj dejstev ki jih orodje ni vrnilo.`

      const messages = [
        { role: 'system', content: SYSTEM },
        ...(history || []).slice(-8).map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: (m.text || '').slice(0, 600)
        })).filter(m => m.content),
        { role: 'user', content: vprasanje }
      ]

      // Step 1: Let LLM decide which tool(s) to call
      const toolResponse = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
        max_tokens: 300,
        temperature: 0.1
      })

      const assistantMsg = toolResponse.choices[0].message
      let profil = null

      // Step 2: Execute tool calls
      if (assistantMsg.tool_calls?.length) {
        messages.push(assistantMsg)

        for (const call of assistantMsg.tool_calls) {
          let args = {}
          try { args = JSON.parse(call.function.arguments) || {} } catch {}

          let result = ''
          if (call.function.name === 'lookup_person') {
            const r = await toolLookupPerson(args.name)
            if (r.found) {
              profil = r.osebe[0]
              result = r.message
              if (profil?.tip === 'akademik' && profil?.profil_url?.includes('ii.feri.um.si')) {
                const dbProfil = await pool.query('SELECT feri_profil_text FROM osebe WHERE id=$1', [profil.id])
                const feriData = dbProfil.rows[0]?.feri_profil_text || await fetchProfilData(profil.profil_url)
                if (feriData) result += `\n\nPodrobni FERI profil:\n${feriData}`
              }
            } else {
              const webResult = await searchWeb(`${args.name} Slovenija`)
              result = `Oseba "${args.name}" ni v bazi Povezava.si.`
              if (webResult) result += `\n\nJavne informacije s spleta:\n${webResult}`
            }
          }
          else if (call.function.name === 'get_database_stats') result = await toolGetStats()
          else if (call.function.name === 'get_company_staff')  result = await toolGetCompanyStaff(args.company)
          else if (call.function.name === 'get_top_connected')  result = await toolGetTopConnected(args.limit)
          else if (call.function.name === 'get_lobists')        result = await toolGetLobists()
          else if (call.function.name === 'get_akademiki')      result = await toolSearchAkademiki()
          else if (call.function.name === 'search_persons')     result = await toolSearchPersons(args.keyword)
          else if (call.function.name === 'compare_persons')    result = await toolComparePersons(args.name1, args.name2)
          else if (call.function.name === 'get_person_articles')result = await toolGetPersonArticles(args.name)
          else if (call.function.name === 'search_web')         result = await searchWeb(args.query) || 'Ni rezultatov.'
          else if (call.function.name === 'get_feri_profile')   result = await toolGetFeriProfile(args.name)

          messages.push({ role: 'tool', tool_call_id: call.id, content: result })
        }
      }

      emit({ meta: { podatki: { profil } } })

      // Step 3: Stream final answer — Groq primary, Gemini fallback on 429
      try {
        emit({ vir: 'groq' })
        const stream = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages,
          max_tokens: 400,
          temperature: 0.3,
          stream: true
        })
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) emit({ chunk: text })
        }
      } catch (groqErr) {
        if (groqErr.status === 429 && process.env.GEMINI_API_KEY) {
          emit({ vir: 'gemini' })
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
          const prompt = messages.map(m => {
            if (m.role === 'system')    return `Navodila: ${m.content}`
            if (m.role === 'user')      return `Uporabnik: ${m.content}`
            if (m.role === 'assistant') return `Asistent: ${m.content || ''}`
            if (m.role === 'tool')      return `Podatki iz baze: ${m.content}`
            return ''
          }).filter(Boolean).join('\n\n')
          const result = await model.generateContentStream(prompt)
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) emit({ chunk: text })
          }
        } else {
          throw groqErr
        }
      }

      emit({ done: true })
      res.end()
    } catch (err) {
      console.error('AI napaka:', err.message)
      if (err.status === 429 && process.env.GEMINI_API_KEY) {
        try {
          emit({ vir: 'gemini' })
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
          const fallbackPrompt = `Si asistent za Povezava.si — slovensko bazo poslovnih in akademskih mrež. Odgovori v slovenščini na naslednje vprašanje (opomni, da podatki iz baze trenutno niso dostopni):\n\n${vprasanje}`
          let result
          for (const mName of ['gemini-2.0-flash-001', 'gemini-2.5-flash']) {
            try {
              result = await genAI.getGenerativeModel({ model: mName }).generateContentStream(fallbackPrompt)
              break
            } catch {}
          }
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) emit({ chunk: text })
          }
          emit({ done: true })
          return res.end()
        } catch (gemErr) {
          console.error('Gemini fallback napaka:', gemErr.message)
        }
      }
      emit({ vir: 'sistem' })
      emit({ chunk: err.status === 429
        ? 'Dnevni limit API-ja je dosežen. Poskusite znova jutri.'
        : 'Napaka pri procesiranju. Prosim poskusite znova.'
      })
      emit({ done: true })
      res.end()
    }
  })

  return router
}