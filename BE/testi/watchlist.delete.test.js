const {
  TEST_EMAIL,
  mockQuery,
  buildApp,
  resetTestState,
  deleteWatchlist,
  getQueryCall
} = require('./watchlistHelpers.test')

describe('DELETE /api/watchlist', () => {
  let app

  beforeEach(() => {
    resetTestState()
    app = buildApp()
  })

  afterAll(() => {
    resetTestState()
  })

  test.each([
    [
      'email',
      {
        oseba_id: 1
      }
    ],
    [
      'oseba_id',
      {
        email: TEST_EMAIL
      }
    ]
  ])(
    'vrne 400, če manjka %s',
    async (_, body) => {
      const res = await deleteWatchlist(
        app,
        body
      )

      expect(res.status).toBe(400)

      expect(res.body).toEqual({
        error: 'Manjka email ali oseba_id'
      })

      expect(mockQuery).not.toHaveBeenCalled()
    }
  )

  test('uspešno odstrani sledenje in vrne ok: true', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: []
    })

    const res = await deleteWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 1
    })

    expect(res.status).toBe(200)

    expect(res.body).toEqual({
      ok: true
    })
  })

  test('uporabi pravilen DELETE SQL in pravilna parametra', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: []
    })

    await deleteWatchlist(app, {
      email: 'janez@primer.si',
      oseba_id: 7
    })

    const {
      sql,
      params
    } = getQueryCall()

    expect(sql).toBe(
      'DELETE FROM watchlist WHERE user_email=$1 AND oseba_id=$2'
    )

    expect(params).toEqual([
      'janez@primer.si',
      7
    ])
  })

  test('vrne ok tudi, če zapis za brisanje ne obstaja', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0
    })

    const res = await deleteWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 999
    })

    expect(res.status).toBe(200)

    expect(res.body).toEqual({
      ok: true
    })
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(
      new Error('DB napaka')
    )

    const res = await deleteWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 1
    })

    expect(res.status).toBe(500)

    expect(res.body).toEqual({
      error: 'DB napaka'
    })
  })
})