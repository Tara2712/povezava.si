const request = require('supertest')
const express = require('express')

const searchRouterFactory = require('../routes/globalSearch')

describe('GET /search', () => {
  let app
  let pool

  beforeEach(() => {
    pool = {
      query: jest.fn()
    }

    app = express()
    app.use(express.json())
    app.use('/search', searchRouterFactory(pool))
  })

  test('vrne združene rezultate (osebe + podjetja)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, ime: 'Ana', priimek: 'Novak', tip: 'oseba', stevilo_povezav: 2 }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 10, naziv: 'ACME d.o.o.', tip: 'podjetje', stevilo_povezav: 5 }
        ]
      })

    const res = await request(app).get('/search?q=ana')

    expect(res.status).toBe(200)

    expect(res.body).toEqual([
      { id: 1, ime: 'Ana', priimek: 'Novak', tip: 'oseba', stevilo_povezav: 2 },
      { id: 10, naziv: 'ACME d.o.o.', tip: 'podjetje', stevilo_povezav: 5 }
    ])

    // preveri da se query pošlje 2x
    expect(pool.query).toHaveBeenCalledTimes(2)

    //  LIKE
    const osebeCall = pool.query.mock.calls[0]
    expect(osebeCall[1]).toEqual(['%ana%'])
  })

  test('če ni q, uporabi prazno iskanje', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/search')

    const osebeCall = pool.query.mock.calls[0]
    expect(osebeCall[1]).toEqual(['%%'])
  })

  test('vrne 500 ob napaki', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB fail'))

    const res = await request(app).get('/search?q=test')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'DB fail')
  })
})