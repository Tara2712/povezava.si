const request = require('supertest')

const {
  TEST_EMAIL,
  mockQuery,
  buildApp,
  resetTestState,
  getWatchlist,
  getQueryCall
} = require('./watchlistHelpers.test')

describe('GET /api/watchlist', () => {
  let app

  beforeEach(() => {
    resetTestState()
    app = buildApp()
  })

  afterAll(() => {
    resetTestState()
  })

  test('vrne 400, če manjka email', async () => {
    const res = await request(app)
      .get('/api/watchlist')

    expect(res.status).toBe(400)

    expect(res.body).toEqual({
      error: 'Manjka email'
    })

    expect(mockQuery).not.toHaveBeenCalled()
  })

  test('vrne seznam sledenih oseb za email', async () => {
    const rows = [
      {
        id: 1,
        ime: 'Ana',
        priimek: 'Kovač',
        fotografija_url: null,
        institucija: 'STA'
      }
    ]

    mockQuery.mockResolvedValueOnce({
      rows
    })

    const res = await getWatchlist(app)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(rows)
  })

  test('vrne prazen seznam, če ni sledenih oseb', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: []
    })

    const res = await getWatchlist(app)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('uporabi pravilno parametrizirano SQL-poizvedbo', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: []
    })

    await getWatchlist(
      app,
      'janez@primer.si'
    )

    const {
      sql,
      params
    } = getQueryCall()

    expect(sql).toContain(
      'FROM watchlist w JOIN osebe o ON o.id = w.oseba_id'
    )

    expect(sql).toContain(
      'WHERE w.user_email = $1'
    )

    expect(sql).toContain(
      'ORDER BY w.created_at DESC'
    )

    expect(params).toEqual([
      'janez@primer.si'
    ])
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(
      new Error('DB napaka')
    )

    const res = await getWatchlist(
      app,
      TEST_EMAIL
    )

    expect(res.status).toBe(500)

    expect(res.body).toEqual({
      error: 'DB napaka'
    })
  })
})