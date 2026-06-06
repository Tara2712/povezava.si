const request = require('supertest')
const express = require('express')

const mockGenerateContent = jest.fn()

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent
    }
  }))
}))


jest.mock('dotenv', () => ({ config: jest.fn() }))

const { setupRoutes } = require('../routes/gemini_ai2')


function buildApp() {
  const app = express()
  app.use(express.json())
  setupRoutes(app)
  return app
}


describe('POST /api/ai/vprasaj', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne 400 če manjka vprašanje', async () => {
    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Manjka vprašanje/i)
  })

  test('vrne 400 če je vprašanje prazen string', async () => {
    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({ vprasanje: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Manjka vprašanje/i)
  })

  test('vrne odgovor za veljavno vprašanje', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'To je testni odgovor.',
      candidates: []
    })

    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({ vprasanje: 'Kdo je predsednik vlade?' })

    expect(res.status).toBe(200)
    expect(res.body.odgovor).toBe('To je testni odgovor.')
    expect(res.body.vir).toBe('gemini')
    expect(res.body.podatki).toBeNull()
  })

  test('pošlje zgodovino v prompt (zadnjih 6 sporočil)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Odgovor z zgodovino.',
      candidates: []
    })

    const history = [
      { role: 'user', text: 'Prvo vprašanje' },
      { role: 'assistant', text: 'Prvi odgovor' }
    ]

    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({ vprasanje: 'Drugo vprašanje', history })

    expect(res.status).toBe(200)

    const calledPrompt = mockGenerateContent.mock.calls[0][0].contents
    expect(calledPrompt).toContain('Uporabnik: Prvo vprašanje')
    expect(calledPrompt).toContain('Asistent: Prvi odgovor')
  })

  test('ignorira neveljavne vnose v history', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Odgovor.',
      candidates: []
    })

    const history = [
      null,
      { role: 'user' },        
      { text: 'brez role' },   
      { role: 'user', text: 'Veljavno' }
    ]

    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({ vprasanje: 'Test', history })

    expect(res.status).toBe(200)

    const calledPrompt = mockGenerateContent.mock.calls[0][0].contents
    expect(calledPrompt).toContain('Uporabnik: Veljavno')
  })

  test('fallback na naslednji model ob 429 napaki', async () => {
    const rateLimitError = new Error('Rate limit')
    rateLimitError.status = 429

    mockGenerateContent
      .mockRejectedValueOnce(rateLimitError)   
      .mockResolvedValueOnce({                  
        text: 'Odgovor iz fallback modela.',
        candidates: []
      })

    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({ vprasanje: 'Testiram fallback' })

    expect(res.status).toBe(200)
    expect(res.body.odgovor).toBe('Odgovor iz fallback modela.')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  test('vrne 500 ob neznani napaki', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Nepričakovana napaka'))

    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({ vprasanje: 'Test napake' })

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Napaka/i)
  })

  test('vrne fallback text če je response.text prazen', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '',
      candidates: []
    })

    const res = await request(app)
      .post('/api/ai/vprasaj')
      .send({ vprasanje: 'Prazni odgovor?' })

    expect(res.status).toBe(200)
    expect(res.body.odgovor).toBe('Ni odgovora.')
  })
})


describe('POST /api/ai/povezava', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne 400 če manjkata entiteti', async () => {
    const res = await request(app)
      .post('/api/ai/povezava')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/entiteta/i)
  })

  test('vrne 400 če entiteta nima tipa ali naziva', async () => {
    const res = await request(app)
      .post('/api/ai/povezava')
      .send({
        entiteta1: { tip: 'oseba' },       
        entiteta2: { naziv: 'Test d.o.o.', tip: 'podjetje' }
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/tip in naziv/i)
  })

  test('vrne odgovor za veljavni entiteti (naziv)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Najdena je bila poslovna povezava.',
      candidates: []
    })

    const res = await request(app)
      .post('/api/ai/povezava')
      .send({
        entiteta1: { naziv: 'Janez Novak', tip: 'oseba' },
        entiteta2: { naziv: 'Telekom d.o.o.', tip: 'podjetje' }
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.odgovor).toBe('Najdena je bila poslovna povezava.')
  })

  test('vrne odgovor za entiteto z "ime" poljem (ne naziv)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Ni znane povezave.',
      candidates: []
    })

    const res = await request(app)
      .post('/api/ai/povezava')
      .send({
        entiteta1: { ime: 'Ana Kovač', tip: 'akademik' },
        entiteta2: { ime: 'Univerza v Ljubljani', tip: 'institucija' }
      })

    expect(res.status).toBe(200)
    expect(res.body.odgovor).toBe('Ni znane povezave.')
  })

  test('vrne fallback text če je response.text prazen', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: null,
      candidates: []
    })

    const res = await request(app)
      .post('/api/ai/povezava')
      .send({
        entiteta1: { naziv: 'X', tip: 'oseba' },
        entiteta2: { naziv: 'Y', tip: 'podjetje' }
      })

    expect(res.status).toBe(200)
    expect(res.body.odgovor).toBe('Ni odgovora.')
  })

  test('vrne 500 ob napaki Gemini klica', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('AI napaka'))

    const res = await request(app)
      .post('/api/ai/povezava')
      .send({
        entiteta1: { naziv: 'X', tip: 'oseba' },
        entiteta2: { naziv: 'Y', tip: 'podjetje' }
      })

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Napaka/i)
  })
})