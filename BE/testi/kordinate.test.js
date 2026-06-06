const request = require('supertest')
const express = require('express')

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const kordiante = require('../routes/kordinate')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/lokacije', kordiante)
  return app
}

describe('GET /lokacije', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne seznam lokacij iz baze', async () => {
    const mockPodjetja = [
      {
        id: 1,
        maticna: '1234567000',
        popolno_ime: 'Test d.o.o.',
        pravna_oblika: 'd.o.o.',
        registrski_organ: 'AJPES',
        ulica: 'Testna ulica',
        hisna_stevilka: '5',
        postna_stevilka: '1000',
        posta: 'Ljubljana',
        drzava: 'Slovenija',
        lat: 46.0569,
        lng: 14.5058
      }
    ]

    mockQuery.mockResolvedValueOnce({ rows: mockPodjetja })

    const res = await request(app).get('/lokacije')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].popolno_ime).toBe('Test d.o.o.')
    expect(res.body[0].lat).toBe(46.0569)
    expect(res.body[0].lng).toBe(14.5058)
  })

  test('vrne prazen seznam če ni rezultatov', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/lokacije')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'))

    const res = await request(app).get('/lokacije')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB connection failed')
  })

  test('query vsebuje filtriranje po lat/lng NOT NULL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/lokacije')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/l\.lat IS NOT NULL/i)
    expect(sql).toMatch(/l\.lng IS NOT NULL/i)
  })

  test('vrne pravilna polja za vsako lokacijo', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          maticna: '9876543000',
          popolno_ime: 'Drugo podjetje d.d.',
          pravna_oblika: 'd.d.',
          registrski_organ: 'AJPES',
          ulica: 'Slovenska cesta',
          hisna_stevilka: '1',
          postna_stevilka: '2000',
          posta: 'Maribor',
          drzava: 'Slovenija',
          lat: 46.5547,
          lng: 15.6459
        }
      ]
    })

    const res = await request(app).get('/lokacije')

    const lokacija = res.body[0]
    expect(lokacija).toHaveProperty('id')
    expect(lokacija).toHaveProperty('maticna')
    expect(lokacija).toHaveProperty('popolno_ime')
    expect(lokacija).toHaveProperty('lat')
    expect(lokacija).toHaveProperty('lng')
    expect(lokacija).toHaveProperty('ulica')
    expect(lokacija).toHaveProperty('posta')
  })
})