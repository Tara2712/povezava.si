const request = require('supertest')
const express = require('express')

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const osebe = require('../routes/osebe')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/osebe', osebe)
  return app
}


function mockParallel(rows1, count) {
  mockQuery.mockImplementationOnce(() =>
    Promise.resolve({ rows: rows1 })
  )
  mockQuery.mockImplementationOnce(() =>
    Promise.resolve({ rows: [{ count: String(count) }] })
  )
}

describe('GET /osebe', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne seznam oseb in skupno število', async () => {
    mockParallel(
      [{ id: 1, ime: 'Ana', priimek: 'Kovač', tip: 'oseba', stevilo_povezav: '5' }],
      1
    )

    const res = await request(app).get('/osebe')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(1)
    expect(res.body.osebe).toHaveLength(1)
    expect(res.body.osebe[0].priimek).toBe('Kovač')
  })

  test('vrne prazen seznam', async () => {
    mockParallel([], 0)

    const res = await request(app).get('/osebe')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(0)
    expect(res.body.osebe).toEqual([])
  })

  test('privzeti limit je 50, offset 0', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(50)
    expect(params).toContain(0)
  })

  test('limit je omejen na max 200', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe?limit=999')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(200)
  })

  test('filter po tipu doda WHERE pogoj', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe?tip=lobist')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain('lobist')
  })

  test('iskanje z ?q= doda LIKE pogoj', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe?q=novak')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain('%novak%')
  })

  test('filter min_povezave doda HAVING pogoj', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe?min_povezave=3')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(3)
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/COUNT.*>=/)
  })

  test('filter max_povezave doda HAVING pogoj', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe?max_povezave=10')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(10)
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/COUNT.*<=/)
  })

  test('sort=az razvrsti po priimku ASC', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe?sort=az')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/priimek ASC/)
  })

  test('sort=za razvrsti po priimku DESC', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe?sort=za')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/priimek DESC/)
  })

  test('privzeti sort je po stevilu_povezav DESC', async () => {
    mockParallel([], 0)

    await request(app).get('/osebe')

    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/stevilo_povezav DESC/)
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/osebe')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})

describe('GET /osebe/primerjaj', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne 400 če manjkata parametra a ali b', async () => {
    const res = await request(app).get('/osebe/primerjaj')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Manjkata parametra/)
  })

  test('vrne 400 če manjka samo b', async () => {
    const res = await request(app).get('/osebe/primerjaj?a=1')

    expect(res.status).toBe(400)
  })

  test('vrne primerjavo dveh oseb s skupnimi podjetji', async () => {
    
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač', stevilo_povezav: '3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, ime: 'Janez', priimek: 'Novak', stevilo_povezav: '5' }] })
      .mockResolvedValueOnce({ rows: [{ id: 10, popolno_ime: 'Skupno podjetje d.o.o.', vloga_a: 'direktor', vloga_b: 'lastnik' }] })

    const res = await request(app).get('/osebe/primerjaj?a=1&b=2')

    expect(res.status).toBe(200)
    expect(res.body.oseba_a.ime).toBe('Ana')
    expect(res.body.oseba_b.ime).toBe('Janez')
    expect(res.body.skupna_podjetja).toHaveLength(1)
    expect(res.body.skupna_podjetja[0].popolno_ime).toBe('Skupno podjetje d.o.o.')
  })

  test('vrne 404 če oseba A ni najdena', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })      
      .mockResolvedValueOnce({ rows: [{ id: 2, ime: 'Janez', priimek: 'Novak' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/osebe/primerjaj?a=999&b=2')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Oseba A ni najdena')
  })

  test('vrne 404 če oseba B ni najdena', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
      .mockResolvedValueOnce({ rows: [] })     
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/osebe/primerjaj?a=1&b=999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Oseba B ni najdena')
  })

  test('skupna_podjetja je prazen seznam če ni skupnih podjetij', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, ime: 'Janez', priimek: 'Novak' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/osebe/primerjaj?a=1&b=2')

    expect(res.status).toBe(200)
    expect(res.body.skupna_podjetja).toEqual([])
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/osebe/primerjaj?a=1&b=2')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})

describe('GET /osebe/:id', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne osebo s povezavami', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač', tip: 'oseba', institucija: 'STA' }]
      })
      .mockResolvedValueOnce({
        rows: [
          { vloga: 'direktor', datum_od: '2020-01-01', datum_do: null, podjetje_id: 10, popolno_ime: 'Firma X', pravna_oblika: 'd.o.o.' }
        ]
      })

    const res = await request(app).get('/osebe/1')

    expect(res.status).toBe(200)
    expect(res.body.ime).toBe('Ana')
    expect(res.body.povezave).toHaveLength(1)
    expect(res.body.povezave[0].vloga).toBe('direktor')
    expect(res.body.povezave[0].popolno_ime).toBe('Firma X')
  })

  test('vrne 404 če oseba ni najdena', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/osebe/999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Oseba ni najdena')
  })

  test('vrne osebo z praznim seznamom povezav', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2, ime: 'Janez', priimek: 'Novak' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/osebe/2')

    expect(res.status).toBe(200)
    expect(res.body.povezave).toEqual([])
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/osebe/1')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })

  test('query je poklican s pravilnim ID parametrom', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, ime: 'Test', priimek: 'User' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/osebe/5')

    expect(mockQuery.mock.calls[0][1]).toEqual(['5'])
  })
})