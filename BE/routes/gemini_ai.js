require('dotenv').config()
const { GoogleGenAI } = require('@google/genai')

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

function labelEntitete(tip, naziv) {
  if (tip === 'oseba') return `oseba: ${naziv}`
  if (tip === 'podjetje') return `podjetje/organizacija: ${naziv}`
  return `${tip}: ${naziv}`
}

function setupRoutes(app) {
  app.post('/api/ai/povezava', async (req, res) => {
    try {
      const {
        entiteta1,
        entiteta2
      } = req.body

      if (!entiteta1 || !entiteta2) {
        return res.status(400).json({
          error: 'Manjkata entiteta1 in entiteta2'
        })
      }

      if (!entiteta1.naziv || !entiteta1.tip || !entiteta2.naziv || !entiteta2.tip) {
        return res.status(400).json({
          error: 'Vsaka entiteta mora imeti tip in naziv'
        })
      }

      const opis1 = labelEntitete(entiteta1.tip, entiteta1.naziv)
      const opis2 = labelEntitete(entiteta2.tip, entiteta2.naziv)

      const prompt = `
      Poišči javno dostopne informacije, ali obstaja možna povezava med naslednjima entitetama:

        1. ${opis1}
        2. ${opis2}

        Preveri predvsem:
        - ali sta omenjeni v istih člankih,
        - ali sta sodelovali na istih dogodkih,
        - ali sta povezani z istimi podjetji, ustanovami, projekti ali funkcijami,
        - ali obstajajo javni viri, ki nakazujejo povezavo,
        - če gre za podjetje, preveri lastnike, upravo, nadzorni svet, projekte, dogodke in medijske objave,
        - če gre za osebo, preveri funkcije, dogodke, podjetja, institucije in članke.

        Odgovori v slovenščini.

        Zelo pomembno:
        - Ne izmišljaj povezave.
        - Če povezava ni potrjena, napiši, da gre samo za možen namig.
        - Loči med "potrjena povezava" in "možen namig".
        - Navedi spletne vire oziroma URL-je, če jih najdeš.
        - Če ne najdeš nič uporabnega, to jasno napiši.
        `

            let response

        try {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        })
        } catch (error) {
        if (error.status === 503) {
            console.warn('gemini-2.5-flash je preobremenjen, poskušam gemini-2.0-flash...')

            response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt
            })
        } else {
            throw error
        }
        }

      return res.json({
        success: true,
        entiteta1,
        entiteta2,
        odgovor: response.text
      })
    } catch (error) {
        console.error('Napaka pri Gemini AI:', error)
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