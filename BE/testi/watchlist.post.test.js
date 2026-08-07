const {
  TEST_EMAIL,
  GMAIL_USER,
  GMAIL_PASS,
  mockSendMail,
  mockQuery,
  nodemailer,
  buildApp,
  enableGmail,
  resetTestState,
  postWatchlist,
  mockNewFollow,
  getQueryCall,
  flushPromises
} = require('./watchlistHelpers.test')

describe('POST /api/watchlist', () => {
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
      const res = await postWatchlist(
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

  test('uporabi INSERT z ON CONFLICT in pravilnima parametroma', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: []
    })

    await postWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 7
    })

    const {
      sql,
      params
    } = getQueryCall()

    expect(sql).toContain(
      'INSERT INTO watchlist (user_email, oseba_id)'
    )

    expect(sql).toContain(
      'VALUES ($1, $2)'
    )

    expect(sql).toContain(
      'ON CONFLICT DO NOTHING'
    )

    expect(sql).toContain(
      'RETURNING id'
    )

    expect(params).toEqual([
      TEST_EMAIL,
      7
    ])
  })

  test('uspešno doda novo sledenje in vrne ok: true', async () => {
    mockNewFollow()

    const res = await postWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 1
    })

    expect(res.status).toBe(200)

    expect(res.body).toEqual({
      ok: true
    })

    expect(mockQuery).toHaveBeenCalledTimes(2)

    expect(
      mockQuery.mock.calls[1][1]
    ).toEqual([1])
  })

  test('ne pošlje emaila ob podvojenem sledenju', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: []
    })

    const res = await postWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 1
    })

    await flushPromises()

    expect(res.status).toBe(200)

    expect(mockQuery).toHaveBeenCalledTimes(1)

    expect(
      mockSendMail
    ).not.toHaveBeenCalled()
  })

  test('ne pošlje emaila, če oseba po INSERT-u ni najdena', async () => {
    enableGmail()

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 99 }]
      })
      .mockResolvedValueOnce({
        rows: []
      })

    const res = await postWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 999
    })

    await flushPromises()

    expect(res.status).toBe(200)

    expect(res.body).toEqual({
      ok: true
    })

    expect(
      mockSendMail
    ).not.toHaveBeenCalled()
  })

  test('pošlje potrditveni email ob novem sledenju', async () => {
    enableGmail()

    mockNewFollow({
      ime: 'Janez',
      priimek: 'Novak'
    })

    const res = await postWatchlist(app, {
      email: 'prejemnik@test.com',
      oseba_id: 5
    })

    await flushPromises()

    expect(res.status).toBe(200)

    expect(
      mockSendMail
    ).toHaveBeenCalledTimes(1)

    expect(
      nodemailer.createTransport
    ).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
      }
    })

    expect(
      mockSendMail
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        from:
          `"Povezava.si" <${GMAIL_USER}>`,
        to: 'prejemnik@test.com',
        subject:
          'Zdaj sledite osebi Janez Novak — Povezava.si',
        html: expect.stringContaining(
          '<strong>Janez Novak</strong>'
        )
      })
    )

    const mailArgs =
      mockSendMail.mock.calls[0][0]

    expect(mailArgs.html).toContain(
      '<h2>Sledenje potrjeno</h2>'
    )

    expect(mailArgs.html).toContain(
      'novo poslovno povezavo'
    )

    expect(mailArgs.html).toContain(
      'https://povezava-si.vercel.app/profil'
    )
  })

  test.each([
    [
      'GMAIL_USER',
      () => {
        process.env.GMAIL_PASS =
          GMAIL_PASS
      }
    ],
    [
      'GMAIL_PASS',
      () => {
        process.env.GMAIL_USER =
          GMAIL_USER
      }
    ]
  ])(
    'ne pošlje emaila, če manjka %s',
    async (_, setupEnv) => {
      setupEnv()

      mockNewFollow()

      const res = await postWatchlist(app, {
        email: TEST_EMAIL,
        oseba_id: 1
      })

      await flushPromises()

      expect(res.status).toBe(200)

      expect(
        mockSendMail
      ).not.toHaveBeenCalled()

      expect(
        nodemailer.createTransport
      ).not.toHaveBeenCalled()
    }
  )

  test('vrne 500, če INSERT v bazo spodleti', async () => {
    mockQuery.mockRejectedValueOnce(
      new Error('DB napaka')
    )

    const res = await postWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 1
    })

    expect(res.status).toBe(500)

    expect(res.body).toEqual({
      error: 'DB napaka'
    })
  })

  test('vrne 500, če pridobivanje osebe spodleti', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 99 }]
      })
      .mockRejectedValueOnce(
        new Error('Napaka pri osebi')
      )

    const res = await postWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 1
    })

    expect(res.status).toBe(500)

    expect(res.body).toEqual({
      error: 'Napaka pri osebi'
    })
  })

  test('ob napaki emaila zapiše opozorilo, API pa ostane uspešen', async () => {
    enableGmail()

    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    mockSendMail.mockRejectedValueOnce(
      new Error('SMTP napaka')
    )

    mockNewFollow()

    const res = await postWatchlist(app, {
      email: TEST_EMAIL,
      oseba_id: 1
    })

    await flushPromises()

    expect(res.status).toBe(200)

    expect(res.body).toEqual({
      ok: true
    })

    expect(warnSpy).toHaveBeenCalledWith(
      'Email napaka:',
      'SMTP napaka'
    )

    warnSpy.mockRestore()
  })

  test.todo(
    'zavrne neveljaven format email naslova'
  )

  test.todo(
    'vrne 404, če oseba_id ne obstaja'
  )
})