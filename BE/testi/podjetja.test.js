const request = require('supertest')
const express = require('express')

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const podjetja = require('../routes/podjetja')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/podjetja', podjetja)
  return app
}

function mockParallel(rows, count) {
  mockQuery
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({ rows: [{ count: String(count) }] })
}

describe('GET /podjetja', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne seznam podjetij in skupno število', async () => {
    mockParallel(
      [{ id: 1, maticna: '1234567000', popolno_ime: 'Test d.o.o.', stevilo_povezav: '3' }],
      1
    )

    const res = await request(app).get('/podjetja')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(1)
    expect(res.body.podjetja).toHaveLength(1)
    expect(res.body.podjetja[0].popolno_ime).toBe('Test d.o.o.')
  })

  test('vrne prazen seznam', async () => {
    mockParallel([], 0)

    const res = await request(app).get('/podjetja')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(0)
    expect(res.body.podjetja).toEqual([])
  })

  test('privzeti limit je 40, offset 0', async () => {
    mockParallel([], 0)

    await request(app).get('/podjetja')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(40)
    expect(params).toContain(0)
  })

  test('limit je omejen na max 200', async () => {
    mockParallel([], 0)

    await request(app).get('/podjetja?limit=999')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(200)
  })

  test('iskanje z ?q= doda LIKE pogoj', async () => {
    mockParallel([], 0)

    await request(app).get('/podjetja?q=telekom')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain('%telekom%')
  })

  test('sort=az razvrsti po imenu ASC', async () => {
    mockParallel([], 0)

    await request(app).get('/podjetja?sort=az')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/popolno_ime ASC/)
  })

  test('sort=za razvrsti po imenu DESC', async () => {
    mockParallel([], 0)

    await request(app).get('/podjetja?sort=za')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/popolno_ime DESC/)
  })

  test('privzeti sort je po stevilo_povezav DESC', async () => {
    mockParallel([], 0)

    await request(app).get('/podjetja')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/stevilo_povezav DESC/)
  })

  test('offset se pravilno prenese', async () => {
    mockParallel([], 0)

    await request(app).get('/podjetja?offset=40')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(40)
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/podjetja')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})


describe('GET /podjetja/id/:id', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne podjetje po ID-ju', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        maticna: '1234567000',
        popolno_ime: 'Firma X d.o.o.',
        posta: 'Ljubljana',
        pravna_oblika: 'd.o.o.',
        ulica: 'Testna',
        hisna_stevilka: '1',
        postna_stevilka: '1000'
      }]
    })

    const res = await request(app).get('/podjetja/id/1')

    expect(res.status).toBe(200)
    expect(res.body.popolno_ime).toBe('Firma X d.o.o.')
    expect(res.body.maticna).toBe('1234567000')
  })

  test('vrne 404 če podjetje ni najdeno', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/podjetja/id/999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Podjetje ni najdeno')
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/podjetja/id/1')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })

  test('query je poklican s pravilnim ID parametrom', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/podjetja/id/5')

    expect(mockQuery.mock.calls[0][1]).toEqual(['5'])
  })
})


describe('GET /podjetja/:maticna', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne podjetje po matični številki', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        maticna: '9876543000',
        popolno_ime: 'Drugo podjetje d.d.',
        posta: 'Maribor',
        pravna_oblika: 'd.d.',
        ulica: 'Slovenska',
        hisna_stevilka: '2',
        postna_stevilka: '2000'
      }]
    })

    const res = await request(app).get('/podjetja/9876543000')

    expect(res.status).toBe(200)
    expect(res.body.maticna).toBe('9876543000')
    expect(res.body.popolno_ime).toBe('Drugo podjetje d.d.')
  })

  test('vrne 404 če matična ni najdena', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/podjetja/0000000000')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Podjetje ni najdeno')
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/podjetja/1234567000')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })

  test('query je poklican s pravilno matično številko', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/podjetja/1234567000')

    expect(mockQuery.mock.calls[0][1]).toEqual(['1234567000'])
  })
})


describe('GET /podjetja/podjetjaVsa', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne seznam vseh podjetij', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, maticna: '1111111000', popolno_ime: 'Alfa d.o.o.', stevilo_povezav: '10' },
        { id: 2, maticna: '2222222000', popolno_ime: 'Beta d.d.', stevilo_povezav: '5' }
      ]
    })

    const res = await request(app).get('/podjetja/podjetjaVsa')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].popolno_ime).toBe('Alfa d.o.o.')
  })

  test('privzeti limit je 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/podjetja/podjetjaVsa')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toEqual([50])
  })

  test('limit se upošteva iz query parametra', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/podjetja/podjetjaVsa?limit=10')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toEqual([10])
  })

  test('SQL vsebuje ORDER BY stevilo_povezav DESC', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/podjetja/podjetjaVsa')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/stevilo_povezav DESC/)
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/podjetja/podjetjaVsa')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})