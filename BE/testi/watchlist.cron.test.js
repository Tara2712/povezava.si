const {
  mockSendMail,
  mockQuery,
  cron,
  resetTestState,
  registerCronJob,
  makeWatchlistRouter,
  normalizeSql
} = require('./watchlistHelpers.test')

describe('Watchlist cron job', () => {
  beforeEach(() => {
    resetTestState()
  })

  afterAll(() => {
    resetTestState()
  })

  test('cron se registrira ob nastavljenem GMAIL_USER', () => {
    process.env.GMAIL_USER =
      'test@gmail.com'

    makeWatchlistRouter({
      query: mockQuery
    })

    expect(
      cron.schedule
    ).toHaveBeenCalledWith(
      '0 8 * * *',
      expect.any(Function)
    )
  })

  test('cron se ne registrira brez GMAIL_USER', () => {
    makeWatchlistRouter({
      query: mockQuery
    })

    expect(
      cron.schedule
    ).not.toHaveBeenCalled()
  })

  test('cron pridobi vse pare uporabnik–oseba', async () => {
    const cronCallback =
      registerCronJob()

    mockQuery.mockResolvedValueOnce({
      rows: []
    })

    await cronCallback()

    expect(
      mockQuery
    ).toHaveBeenCalledTimes(1)

    const [sql] =
      mockQuery.mock.calls[0]

    const normalized =
      normalizeSql(sql)

    expect(normalized).toContain(
      'SELECT DISTINCT w.user_email, w.oseba_id, o.ime, o.priimek'
    )

    expect(normalized).toContain(
      'FROM watchlist w JOIN osebe o ON o.id = w.oseba_id'
    )
  })

  test('cron preverja povezave iz zadnjih 24 ur in uporabi LIMIT 5', async () => {
    const cronCallback =
      registerCronJob()

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            user_email:
              'test@test.com',
            oseba_id: 7,
            ime: 'Ana',
            priimek: 'Kovač'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: []
      })

    await cronCallback()

    const [sql, params] =
      mockQuery.mock.calls[1]

    const normalized =
      normalizeSql(sql)

    expect(normalized).toContain(
      'FROM povezave p JOIN podjetja d ON d.id = p.podjetje_id'
    )

    expect(normalized).toContain(
      "p.created_at >= NOW() - INTERVAL '24 hours'"
    )

    expect(normalized).toContain(
      'LIMIT 5'
    )

    expect(params).toEqual([7])
  })

  test('cron ne pošlje emaila, če ni novih povezav', async () => {
    const cronCallback =
      registerCronJob()

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            user_email:
              'test@test.com',
            oseba_id: 7,
            ime: 'Ana',
            priimek: 'Kovač'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: []
      })

    await cronCallback()

    expect(
      mockSendMail
    ).not.toHaveBeenCalled()
  })

  test('cron pošlje en skupen email za več oseb istega uporabnika', async () => {
    const cronCallback =
      registerCronJob()

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            user_email:
              'test@test.com',
            oseba_id: 1,
            ime: 'Ana',
            priimek: 'Kovač'
          },
          {
            user_email:
              'test@test.com',
            oseba_id: 2,
            ime: 'Janez',
            priimek: 'Novak'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            popolno_ime:
              'Alfa d.o.o.',
            vloga: 'direktor'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            popolno_ime:
              'Beta d.d.',
            vloga: 'lastnik'
          },
          {
            popolno_ime:
              'Gama d.o.o.',
            vloga: 'prokurist'
          }
        ]
      })

    await cronCallback()

    expect(
      mockSendMail
    ).toHaveBeenCalledTimes(1)

    const mailArgs =
      mockSendMail.mock.calls[0][0]

    expect(mailArgs.to).toBe(
      'test@test.com'
    )

    expect(mailArgs.subject).toBe(
      'Novosti pri sledenih osebah — Povezava.si'
    )

    expect(mailArgs.html).toContain(
      '<strong>Ana Kovač</strong>'
    )

    expect(mailArgs.html).toContain(
      'direktor pri Alfa d.o.o.'
    )

    expect(mailArgs.html).toContain(
      '<strong>Janez Novak</strong>'
    )

    expect(mailArgs.html).toContain(
      'lastnik pri Beta d.d.'
    )

    expect(mailArgs.html).toContain(
      'prokurist pri Gama d.o.o.'
    )
  })

  test('cron pošlje ločen email vsakemu uporabniku', async () => {
    const cronCallback =
      registerCronJob()

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            user_email:
              'ana@test.com',
            oseba_id: 1,
            ime: 'Miha',
            priimek: 'Horvat'
          },
          {
            user_email:
              'janez@test.com',
            oseba_id: 2,
            ime: 'Maja',
            priimek: 'Zupan'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            popolno_ime:
              'Alfa d.o.o.',
            vloga: 'direktor'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            popolno_ime:
              'Beta d.d.',
            vloga: 'lastnik'
          }
        ]
      })

    await cronCallback()

    expect(
      mockSendMail
    ).toHaveBeenCalledTimes(2)

    const recipients =
      mockSendMail.mock.calls
        .map(call => call[0].to)
        .sort()

    expect(recipients).toEqual([
      'ana@test.com',
      'janez@test.com'
    ])
  })

  test('cron ob napaki baze zapiše napako', async () => {
    const cronCallback =
      registerCronJob()

    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    mockQuery.mockRejectedValueOnce(
      new Error('Cron DB napaka')
    )

    await cronCallback()

    expect(errorSpy).toHaveBeenCalledWith(
      'Cron napaka:',
      'Cron DB napaka'
    )

    expect(
      mockSendMail
    ).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  test('cron ob napaki Gmaila zapiše napako', async () => {
    const cronCallback =
      registerCronJob()

    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    mockSendMail.mockRejectedValueOnce(
      new Error('SMTP ni dosegljiv')
    )

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            user_email:
              'test@test.com',
            oseba_id: 1,
            ime: 'Ana',
            priimek: 'Kovač'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            popolno_ime:
              'Alfa d.o.o.',
            vloga: 'direktor'
          }
        ]
      })

    await cronCallback()

    expect(errorSpy).toHaveBeenCalledWith(
      'Cron napaka:',
      'SMTP ni dosegljiv'
    )

    errorSpy.mockRestore()
  })
})