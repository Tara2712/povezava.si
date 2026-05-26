require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { GoogleGenAI } = require('@google/genai')

const app = express()

app.use(cors())
app.use(express.json())

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

app.post('/api/ai/vprasaj', async (req, res) => {
  try {
    const { vprasanje } = req.body

    if (!vprasanje) {
      return res.status(400).json({
        error: 'Manjka vprašanje.'
      })
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: vprasanje,
      config: {
        tools: [
          {
            googleSearch: {}
          }
        ]
      }
    })

    res.json({
      odgovor: response.text || 'Ni odgovora.',
      podatki: null,
      vir: 'gemini'
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      odgovor: 'Napaka pri Gemini API.',
      podatki: null,
      vir: 'sistem',
      error: error.message
    })
  }
})

const PORT = 5001

app.listen(PORT, () => {
  console.log(`Gemini test server teče na http://localhost:${PORT}`)
})