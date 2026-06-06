const request = require('supertest')
const express = require('express')

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const stats = require('../routes/stats')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/stats', stats)
  return app
}

describe('GET /stats', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne število oseb, podjetij in povezav', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '150' }] }) 
      .mockResolvedValueOnce({ rows: [{ count: '80' }] })   
      .mockResolvedValueOnce({ rows: [{ count: '320' }] })  

    const res = await request(app).get('/stats')

    expect(res.status).toBe(200)
    expect(res.body.osebe).toBe(150)
    expect(res.body.podjetja).toBe(80)
    expect(res.body.povezave).toBe(320)
  })

  test('vrednosti so številke (parseInt), ne nizi', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockResolvedValueOnce({ rows: [{ count: '20' }] })
      .mockResolvedValueOnce({ rows: [{ count: '30' }] })

    const res = await request(app).get('/stats')

    expect(typeof res.body.osebe).toBe('number')
    expect(typeof res.body.podjetja).toBe('number')
    expect(typeof res.body.povezave).toBe('number')
  })

  test('vrne 0 če so tabele prazne', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    const res = await request(app).get('/stats')

    expect(res.status).toBe(200)
    expect(res.body.osebe).toBe(0)
    expect(res.body.podjetja).toBe(0)
    expect(res.body.povezave).toBe(0)
  })

  test('response ima točno polja osebe, podjetja, povezave', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })

    const res = await request(app).get('/stats')

    expect(Object.keys(res.body)).toEqual(['osebe', 'podjetja', 'povezave'])
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/stats')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})