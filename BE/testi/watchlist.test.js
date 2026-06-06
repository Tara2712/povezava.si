const request = require('supertest')
const express = require('express')

const mockSendMail = jest.fn().mockResolvedValue({})
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail }))
}))

jest.mock('node-cron', () => ({ schedule: jest.fn() }))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const makeWatchlistRouter = require('../routes/watchlist')

const mockQuery = jest.fn()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/watchlist', makeWatchlistRouter({ query: mockQuery }))
  return app
}

describe('GET /api/watchlist', () => {
  let app

  beforeEach(() => {
    jest.clearAllMocks()
    app = buildApp()
  })

  test('vrne 400 če manjka email', async () => {
    const res = await request(app).get('/api/watchlist')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Manjka email')
  })

  test('vrne seznam sledenih oseb za email', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač', fotografija_url: null, institucija: 'STA' }]
    })

    const res = await request(app).get('/api/watchlist?email=test@test.com')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].ime).toBe('Ana')
  })

  test('vrne prazen seznam če ni sledenih oseb', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/api/watchlist?email=test@test.com')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('query je poklican s pravilnim emailom', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/api/watchlist?email=janez@primer.si')

    expect(mockQuery.mock.calls[0][1]).toEqual(['janez@primer.si'])
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/api/watchlist?email=test@test.com')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})

describe('POST /api/watchlist', () => {
  let app

  beforeEach(() => {
    jest.clearAllMocks()
    app = buildApp()
  })

  test('vrne 400 če manjka email', async () => {
    const res = await request(app).post('/api/watchlist').send({ oseba_id: 1 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Manjka email ali oseba_id')
  })

  test('vrne 400 če manjka oseba_id', async () => {
    const res = await request(app).post('/api/watchlist').send({ email: 'test@test.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Manjka email ali oseba_id')
  })

  test('uspešno doda novo sledenje in vrne ok: true', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [{ ime: 'Ana', priimek: 'Kovač' }] })

    const res = await request(app)
      .post('/api/watchlist')
      .send({ email: 'test@test.com', oseba_id: 1 })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('ne pošlje emaila ob podvojenem sledenju (ON CONFLICT)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }) 

    await request(app)
      .post('/api/watchlist')
      .send({ email: 'test@test.com', oseba_id: 1 })

    await new Promise(r => setTimeout(r, 50))
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  test('pošlje potrditveni email ob novem sledenju', async () => {
    process.env.GMAIL_USER = 'test@gmail.com'
    process.env.GMAIL_PASS = 'geslo'

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [{ ime: 'Janez', priimek: 'Novak' }] })

    await request(app)
      .post('/api/watchlist')
      .send({ email: 'test@test.com', oseba_id: 5 })

    await new Promise(r => setTimeout(r, 50))

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const mailArgs = mockSendMail.mock.calls[0][0]
    expect(mailArgs.to).toBe('test@test.com')
    expect(mailArgs.subject).toContain('Janez Novak')

    delete process.env.GMAIL_USER
    delete process.env.GMAIL_PASS
  })

  test('ne pošlje emaila če GMAIL_USER ni nastavljen', async () => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_PASS

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [{ ime: 'Ana', priimek: 'Kovač' }] })

    await request(app)
      .post('/api/watchlist')
      .send({ email: 'test@test.com', oseba_id: 1 })

    await new Promise(r => setTimeout(r, 50))
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app)
      .post('/api/watchlist')
      .send({ email: 'test@test.com', oseba_id: 1 })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})

describe('DELETE /api/watchlist', () => {
  let app

  beforeEach(() => {
    jest.clearAllMocks()
    app = buildApp()
  })

  test('vrne 400 če manjka email', async () => {
    const res = await request(app).delete('/api/watchlist').send({ oseba_id: 1 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Manjka email ali oseba_id')
  })

  test('vrne 400 če manjka oseba_id', async () => {
    const res = await request(app).delete('/api/watchlist').send({ email: 'test@test.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Manjka email ali oseba_id')
  })

  test('uspešno odstrani sledenje in vrne ok: true', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .delete('/api/watchlist')
      .send({ email: 'test@test.com', oseba_id: 1 })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('query je poklican s pravilnima parametroma', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app)
      .delete('/api/watchlist')
      .send({ email: 'janez@primer.si', oseba_id: 7 })

    expect(mockQuery.mock.calls[0][1]).toEqual(['janez@primer.si', 7])
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app)
      .delete('/api/watchlist')
      .send({ email: 'test@test.com', oseba_id: 1 })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})

describe('Cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('cron se registrira če je GMAIL_USER nastavljen', () => {
    const cron = require('node-cron')
    process.env.GMAIL_USER = 'test@gmail.com'

    makeWatchlistRouter({ query: mockQuery })

    expect(cron.schedule).toHaveBeenCalledWith('0 8 * * *', expect.any(Function))

    delete process.env.GMAIL_USER
  })

  test('cron se ne registrira brez GMAIL_USER', () => {
    const cron = require('node-cron')
    delete process.env.GMAIL_USER

    makeWatchlistRouter({ query: mockQuery })

    expect(cron.schedule).not.toHaveBeenCalled()
  })
})