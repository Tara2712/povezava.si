require('dotenv').config()
const { GoogleGenAI } = require('@google/genai')

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

const groundingTool = {
  googleSearch: {}
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return []

  return history
    .filter(m => m && m.text && m.role)
    .slice(-6)
    .map(m => {
      const role = m.role === 'user' ? 'Uporabnik' : 'Asistent'
      return `${role}: ${m.text}`
    })
    .join('\n')
}

function extractSources(response) {
  try {
    const chunks =
      response?.candidates?.[0]?.groundingMetadata?.groundingChunks || []

    return chunks
      .map(chunk => chunk.web)
      .filter(Boolean)
      .map(web => ({
        title: web.title,
        url: web.uri
      }))
      .filter(source => source.url)
  } catch (_) {
    return []
  }
}

async function generateWithFallback({ contents, config }) {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash'
  ]

  let lastError = null

  for (const model of models) {
    try {
      console.log(`Poskušam Gemini model: ${model}`)

      return await ai.models.generateContent({
        model,
        contents,
        config
      })
    } catch (error) {
      lastError = error

      if ([429, 500, 503].includes(error.status)) {
        console.warn(`${model} ni dosegljiv ali je kvota/preobremenitev: ${error.message}`)
        continue
      }

      throw error
    }
  }

  throw lastError
}

function setupRoutes(app) {
  app.post('/api/ai/vprasaj', async (req, res) => {
    try {
      const { vprasanje, history } = req.body

      if (!vprasanje || !vprasanje.trim()) {
        return res.status(400).json({
          error: 'Manjka vprašanje.'
        })
      }

      const zgodovina = normalizeHistory(history)

      const prompt = `
Si AI asistent za spletno aplikacijo Povezava.si.

Uporabnik te lahko vpraša karkoli:
- o osebah,
- podjetjih,
- poslovnih povezavah,
- akademikih,
- javno dostopnih informacijah,
- aktualnih dogodkih,
- splošnih dejstvih,
- razlagi pojmov,
- ali drugih temah.

Odgovarjaj v slovenščini.

Pravila:
- Odgovori neposredno na vprašanje uporabnika.
- Uporabi spletno iskanje, kadar je vprašanje aktualno, specifično ali zahteva preverjanje.
- Ne išči samo entitet in ne primerjaj dveh entitet, razen če uporabnik to izrecno zahteva.
- Ne izmišljaj dejstev.
- Če ne najdeš dovolj zanesljivih informacij, to jasno povej.
- Če uporabljaš spletne vire, jih na koncu kratko navedi.
- Odgovor naj bo uporaben, jasen in ne predolg.
- Če je vprašanje povezano s Povezava.si, pojasni v kontekstu oseb, podjetij in javnih povezav.
- Če vprašanje ni povezano s Povezava.si, vseeno normalno odgovori.

Zadnja zgodovina pogovora:
${zgodovina || 'Ni prejšnje zgodovine.'}

Vprašanje uporabnika:
${vprasanje}
      `.trim()

      const response = await generateWithFallback({
        contents: prompt,
        config: {
          tools: [groundingTool]
        }
      })

      const sources = extractSources(response)

      let odgovor = response.text || 'Ni odgovora.'

      if (sources.length > 0) {
        const uniqueSources = []
        const seen = new Set()

        for (const source of sources) {
          if (!seen.has(source.url)) {
            seen.add(source.url)
            uniqueSources.push(source)
          }
        }

        odgovor += '\n\nViri:\n'
        odgovor += uniqueSources
          .slice(0, 5)
          .map(source => `- ${source.title || source.url}: ${source.url}`)
          .join('\n')
      }

      return res.json({
        odgovor,
        podatki: null,
        vir: 'gemini'
      })
    } catch (error) {
      console.error('Napaka pri Gemini AI:', error)

      return res.status(500).json({
        odgovor: 'Napaka pri klicu AI asistenta. Poskusite znova.',
        podatki: null,
        vir: 'sistem',
        error: 'Napaka pri AI odgovoru',
        details: error.message
      })
    }
  })

  app.post('/api/ai/povezava', async (req, res) => {
    try {
      const { entiteta1, entiteta2 } = req.body

      if (!entiteta1 || !entiteta2) {
        return res.status(400).json({
          error: 'Manjkata entiteta1 in entiteta2'
        })
      }

      const naziv1 = entiteta1.naziv || entiteta1.ime || ''
      const naziv2 = entiteta2.naziv || entiteta2.ime || ''

      if (!naziv1 || !entiteta1.tip || !naziv2 || !entiteta2.tip) {
        return res.status(400).json({
          error: 'Vsaka entiteta mora imeti tip in naziv'
        })
      }

      const prompt = `
Poišči javno dostopne informacije, ali obstaja možna povezava med naslednjima entitetama:

1. ${entiteta1.tip}: ${naziv1}
2. ${entiteta2.tip}: ${naziv2}

Odgovori v slovenščini.

Pravila:
- Ne izmišljaj povezave.
- Loči med potrjeno povezavo in možnim namigom.
- Če povezave ne najdeš, to jasno napiši.
- Navedi spletne vire, če jih najdeš.
      `.trim()

      const response = await generateWithFallback({
        contents: prompt,
        config: {
          tools: [groundingTool]
        }
      })

      return res.json({
        success: true,
        entiteta1,
        entiteta2,
        odgovor: response.text || 'Ni odgovora.'
      })
    } catch (error) {
      console.error('Napaka pri Gemini AI povezavi:', error)

      return res.status(500).json({
        error: 'Napaka pri AI iskanju povezave',
        details: error.message
      })
    }
  })
}

module.exports = {
  setupRoutes
}