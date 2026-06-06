const request = require('supertest')
const express = require('express')


const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const lobisti = require('../routes/lobisti')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/lobisti', lobisti)
  return app
}


describe('GET /lobisti', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne seznam lobistov in skupno število', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            ime: 'Janez',
            priimek: 'Novak',
            fotografija_url: null,
            delodajalec: 'Firma d.o.o.',
            narocnik: 'Stranka X',
            datum_vpisa: '2020-01-01',
            datum_izpisa: null,
            registrska_st: 'L-001',
            vir_url: 'https://example.com',
            stevilo_povezav: '3'
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    const res = await request(app).get('/lobisti')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(1)
    expect(res.body.lobisti).toHaveLength(1)
    expect(res.body.lobisti[0].priimek).toBe('Novak')
  })

  test('vrne prazen seznam če ni lobistov', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    const res = await request(app).get('/lobisti')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(0)
    expect(res.body.lobisti).toEqual([])
  })

  test('privzeti limit je 50 in offset 0', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/lobisti')

    const sql = mockQuery.mock.calls[0][0]
    const params = mockQuery.mock.calls[0][1]

    expect(sql).toMatch(/LIMIT/i)
    expect(params).toContain(50)  
    expect(params).toContain(0)   
  })

  test('limit je omejen na max 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/lobisti?limit=999')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(200)
  })

  test('iskanje z parametrom q doda WHERE pogoj', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/lobisti?q=novak')

    const params = mockQuery.mock.calls[0][1]
    expect(params[0]).toBe('%novak%')
  })

  test('offset se pravilno prenese', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/lobisti?offset=20')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(20)
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/lobisti')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})


describe('GET /lobisti/:id', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne lobista po ID-ju', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          ime: 'Ana',
          priimek: 'Kovač',
          tip: 'lobist',
          delodajalec: 'Agencija d.o.o.',
          narocnik: 'Minister X',
          datum_vpisa: '2019-03-15',
          datum_izpisa: null,
          registrska_st: 'L-005',
          vir_url: 'https://example.com/ana'
        }
      ]
    })

    const res = await request(app).get('/lobisti/5')

    expect(res.status).toBe(200)
    expect(res.body.ime).toBe('Ana')
    expect(res.body.priimek).toBe('Kovač')
    expect(res.body.registrska_st).toBe('L-005')
  })

  test('vrne 404 če lobist ni najden', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/lobisti/999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Lobist ni najden')
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/lobisti/1')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })

  test('query vsebuje filter po tipu lobist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/lobisti/42')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/o\.tip = 'lobist'/i)
  })

  test('query je poklican z pravilnim ID parametrom', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/lobisti/7')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toEqual(['7'])
  })
})