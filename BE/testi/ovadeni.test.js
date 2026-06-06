const request = require('supertest')
const express = require('express')

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('https', () => ({
  request: jest.fn()
}))

const mockHttpsRequest = require('https').request

jest.mock('dotenv', () => ({ config: jest.fn() }))

const ovadeni = require('../routes/ovadeni')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/ovadeni', ovadeni)
  return app
}

function mockHttpResponse(html) {
  mockHttpsRequest.mockImplementationOnce((options, callback) => {
    const mockRes = {
      on: (event, handler) => {
        if (event === 'data') handler(html)
        if (event === 'end') handler()
        return mockRes
      }
    }
    callback(mockRes)
    return { on: jest.fn().mockReturnThis(), end: jest.fn() }
  })
}

describe('GET /ovadeni/sodnapraksa', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne prazen rezultat če manjka q', async () => {
    const res = await request(app).get('/ovadeni/sodnapraksa')

    expect(res.status).toBe(200)
    expect(res.body.results).toEqual([])
    expect(res.body.strani).toBe(0)
  })

  test('vrne razčlenjen HTML z rezultati', async () => {
    const html = `
      <table id="results-table">
        <tr class="odd">
          <td>1</td>
          <td>VSRS Sodba I Ips 1/2020</td>
          <td>Vrhovno sodišče</td>
          <td>Kazenski oddelek</td>
          <td>12.01.2020</td>
          <td>kaznivo dejanje</td>
          <td>Jedro zadeve</td>
        </tr>
      </table>
      <a href="?id=abc123">link</a>
    `
    mockHttpResponse(html)

    const res = await request(app).get('/ovadeni/sodnapraksa?q=test')

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].sodisce).toBe('Vrhovno sodišče')
    expect(res.body.results[0].dokument).toBe('VSRS Sodba I Ips 1/2020')
    expect(res.body.results[0].datum).toBe('12.01.2020')
  })

  test('vrne prazen rezultat če HTML nima tabele', async () => {
    mockHttpResponse('<html><body>Ni rezultatov</body></html>')

    const res = await request(app).get('/ovadeni/sodnapraksa?q=test')

    expect(res.status).toBe(200)
    expect(res.body.results).toEqual([])
    expect(res.body.strani).toBe(0)
  })

  test('zazna število strani iz paginacije', async () => {
    const html = `
      <table id="results-table"></table>
      <a href="?page=0">1</a>
      <a href="?page=1">2</a>
      <a href="?page=2">3</a>
    `
    mockHttpResponse(html)

    const res = await request(app).get('/ovadeni/sodnapraksa?q=test')

    expect(res.body.strani).toBe(3) 
  })

  test('vrne 500 ob napaki fetchUrl', async () => {
    mockHttpsRequest.mockImplementationOnce((options, callback) => {
      const req = {
        on: jest.fn().mockImplementationOnce((event, handler) => {
          if (event === 'error') handler(new Error('Network napaka'))
          return req
        }),
        end: jest.fn()
      }
      return req
    })

    const res = await request(app).get('/ovadeni/sodnapraksa?q=test')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Network napaka')
  })
})

describe('GET /ovadeni', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne seznam ovadenih in skupno število', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'Janez', priimek: 'Novak', zadeva: 'Korupcija', status: 'obtožen' }]
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    const res = await request(app).get('/ovadeni')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(1)
    expect(res.body.ovadeni).toHaveLength(1)
    expect(res.body.ovadeni[0].priimek).toBe('Novak')
  })

  test('vrne prazen seznam', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    const res = await request(app).get('/ovadeni')

    expect(res.status).toBe(200)
    expect(res.body.skupaj).toBe(0)
    expect(res.body.ovadeni).toEqual([])
  })

  test('privzeti limit je 50, offset 0', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/ovadeni')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(50)
    expect(params).toContain(0)
  })

  test('limit je omejen na max 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/ovadeni?limit=500')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain(200)
  })

  test('iskanje z ?q= doda LIKE pogoj', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/ovadeni?q=novak')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain('%novak%')
  })

  test('filter po statusu doda WHERE pogoj', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/ovadeni?status=obtožen')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain('obtožen')
    const sql = mockQuery.mock.calls[0][0]
    expect(sql).toMatch(/status = /)
  })

  test('kombinacija q in status deluje skupaj', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })

    await request(app).get('/ovadeni?q=novak&status=obtožen')

    const params = mockQuery.mock.calls[0][1]
    expect(params).toContain('%novak%')
    expect(params).toContain('obtožen')
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/ovadeni')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})


describe('GET /ovadeni/:id', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('vrne vnos po ID-ju', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 3, ime: 'Ana', priimek: 'Kovač', zadeva: 'Goljufija', status: 'obtožen' }]
    })

    const res = await request(app).get('/ovadeni/3')

    expect(res.status).toBe(200)
    expect(res.body.ime).toBe('Ana')
    expect(res.body.zadeva).toBe('Goljufija')
  })

  test('vrne 404 če vnos ni najden', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/ovadeni/999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Vnos ni najden')
  })

  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/ovadeni/1')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })

  test('query je poklican s pravilnim ID parametrom', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await request(app).get('/ovadeni/7')

    expect(mockQuery.mock.calls[0][1]).toEqual(['7'])
  })
})


describe('parseSodnapraksa (preko /sodnapraksa endpoint)', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })

  test('HTML entitete se pravilno dekodirajo', async () => {
    const html = `
      <table id="results-table">
        <tr class="even">
          <td>1</td>
          <td>Zadeva &amp; primer</td>
          <td>Sodišče &lt;Ljubljana&gt;</td>
          <td>Oddelek</td>
          <td>01.01.2023</td>
          <td>institut</td>
          <td>jedro</td>
        </tr>
      </table>
    `
    mockHttpResponse(html)

    const res = await request(app).get('/ovadeni/sodnapraksa?q=test')

    expect(res.body.results[0].dokument).toBe('Zadeva & primer')
    expect(res.body.results[0].sodisce).toBe('Sodišče <Ljubljana>')
  })

  test('vrstice z manj kot 5 celicami se preskočijo', async () => {
    const html = `
      <table id="results-table">
        <tr class="odd">
          <td>1</td>
          <td>2</td>
          <td>3</td>
        </tr>
      </table>
    `
    mockHttpResponse(html)

    const res = await request(app).get('/ovadeni/sodnapraksa?q=test')

    expect(res.body.results).toHaveLength(0)
  })

  test('vir_url se pravilno sestavi iz href id parametra', async () => {
    const html = `
      <table id="results-table">
        <tr class="odd">
          <td>1</td>
          <td>Dokument</td>
          <td>Sodišče</td>
          <td>Oddelek</td>
          <td>01.01.2023</td>
          <td>institut</td>
          <td>jedro</td>
          <a href="/zadeva?id=XYZ789">povezava</a>
        </tr>
      </table>
    `
    mockHttpResponse(html)

    const res = await request(app).get('/ovadeni/sodnapraksa?q=test')

    expect(res.body.results[0].vir_url).toBe('https://www.sodnapraksa.si/?id=XYZ789')
  })
})
