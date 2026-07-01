const request = require('supertest')
const express = require('express')

const akademikiRouterFactory = require('../routes/akademiki')

describe('GET /akademiki', () => {
  let app
  let pool

  beforeEach(() => {
    pool = {
      query: jest.fn()
    }

    app = express()
    app.use(express.json())
    app.use('/akademiki', akademikiRouterFactory(pool))
  })

  test('vrne seznam akademikov (default limit 5)', async () => {
    const fakeRows = [
      { id: 1, ime: 'Ana', priimek: 'Novak' },
      { id: 2, ime: 'Marko', priimek: 'Horvat' }
    ]

    pool.query.mockResolvedValueOnce({ rows: fakeRows })

    const res = await request(app).get('/akademiki')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(fakeRows)

    expect(pool.query).toHaveBeenCalled()
    const callArgs = pool.query.mock.calls[0]
    expect(callArgs[1]).toEqual([5])
  })

  test('upošteva limit iz query parametra', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/akademiki?limit=10')

    const callArgs = pool.query.mock.calls[0]
    expect(callArgs[1]).toEqual([10])
  })

  test('vrne 500 ob napaki', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app).get('/akademiki')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'DB error')
  })
})