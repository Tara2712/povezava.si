const request = require('supertest')
const express = require('express')

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const search = require('../routes/search')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/search', search)
  return app
}

describe('GET /search', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne kombinirane rezultate oseb in podjetij', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač', tip: 'oseba', stevilo_povezav: '3' }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, naziv: 'Telekom d.d.', tip: 'podjetje', stevilo_povezav: '15' }]
      })

    const res = await request(app).get('/search?q=ana')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].tip).toBe('oseba')
    expect(res.body[1].tip).toBe('podjetje')
  })

  test('vrne prazen seznam če ni rezultatov', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/search?q=xxxxxxxx')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('brez ?q= vrne rezultate z %% (vse)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Test', priimek: 'User', tip: 'oseba', stevilo_povezav: '1' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/search')

    const params1 = mockQuery.mock.calls[0][1]
    const params2 = mockQuery.mock.calls[1][1]
    expect(params1).toEqual(['%%'])
    expect(params2).toEqual(['%%'])
  })

  test('iskalni parameter se pravilno ovije z %', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/search?q=novak')

    expect(mockQuery.mock.calls[0][1]).toEqual(['%novak%'])
    expect(mockQuery.mock.calls[1][1]).toEqual(['%novak%'])
  })

  test('osebe imajo polja id, ime, priimek, tip, stevilo_povezav', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač', tip: 'oseba', stevilo_povezav: '2' }]
      })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/search?q=ana')

    const oseba = res.body[0]
    expect(oseba).toHaveProperty('id')
    expect(oseba).toHaveProperty('ime')
    expect(oseba).toHaveProperty('priimek')
    expect(oseba).toHaveProperty('tip', 'oseba')
    expect(oseba).toHaveProperty('stevilo_povezav')
  })

  test('podjetja imajo polja id, naziv, tip, stevilo_povezav', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 5, naziv: 'Firma X d.o.o.', tip: 'podjetje', stevilo_povezav: '7' }]
      })

    const res = await request(app).get('/search?q=firma')

    const podjetje = res.body[0]
    expect(podjetje).toHaveProperty('id')
    expect(podjetje).toHaveProperty('naziv')
    expect(podjetje).toHaveProperty('tip', 'podjetje')
    expect(podjetje).toHaveProperty('stevilo_povezav')
  })

  test('SQL za osebe vsebuje LIMIT 10', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/search?q=test')

    expect(mockQuery.mock.calls[0][0]).toMatch(/LIMIT 10/)
    expect(mockQuery.mock.calls[1][0]).toMatch(/LIMIT 10/)
  })

  test('vrne samo osebe če podjetij ni', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: 1, ime: 'Ana', priimek: 'Kovač', tip: 'oseba', stevilo_povezav: '1' },
          { id: 2, ime: 'Maja', priimek: 'Novak', tip: 'oseba', stevilo_povezav: '2' }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/search?q=a')

    expect(res.body).toHaveLength(2)
    expect(res.body.every(r => r.tip === 'oseba')).toBe(true)
  })

  test('vrne samo podjetja če oseb ni', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 10, naziv: 'Telekom d.d.', tip: 'podjetje', stevilo_povezav: '5' }]
      })

    const res = await request(app).get('/search?q=telekom')

    expect(res.body).toHaveLength(1)
    expect(res.body[0].tip).toBe('podjetje')
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/search?q=test')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})