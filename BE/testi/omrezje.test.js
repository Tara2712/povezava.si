const request = require('supertest')
const express = require('express')

const mockQuery = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery
  }))
}))

jest.mock('dotenv', () => ({ config: jest.fn() }))

const omrezje = require('../routes/omrezje')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/omrezje', omrezje)
  return app
}

describe('GET /omrezje/:id', () => {
  let app

  beforeEach(() => {
    app = buildApp()
    jest.clearAllMocks()
  })


  test('vrne 404 če oseba ni najdena', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/omrezje/999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Oseba ni najdena')
  })


  test('vrne center, nodes, edges in maxDepth', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/omrezje/1')

    expect(res.status).toBe(200)
    expect(res.body.center).toEqual({ id: 1, name: 'Ana Kovač' })
    expect(Array.isArray(res.body.nodes)).toBe(true)
    expect(Array.isArray(res.body.edges)).toBe(true)
    expect(res.body.maxDepth).toBe(3) 
  })

  test('center oseba je v nodes z isCenter: true', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/omrezje/1')

    const center = res.body.nodes.find(n => n.isCenter)
    expect(center).toBeDefined()
    expect(center.name).toBe('Ana Kovač')
    expect(center.type).toBe('oseba')
    expect(center.depth).toBe(0)
  })


  test('BFS vrne osebo in njeni podjetji kot nodes in edges', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Janez', priimek: 'Novak' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [
        { oseba_id: 1, podjetje_id: 10, popolno_ime: 'Podjetje A d.o.o.', vloga: 'direktor' },
        { oseba_id: 1, podjetje_id: 11, popolno_ime: 'Podjetje B d.o.o.', vloga: 'lastnik' }
      ]
    })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/omrezje/1')

    expect(res.status).toBe(200)

    const nodeTypes = res.body.nodes.map(n => n.type)
    expect(nodeTypes).toContain('podjetje')

    const podjetjeA = res.body.nodes.find(n => n.name === 'Podjetje A d.o.o.')
    expect(podjetjeA).toBeDefined()
    expect(podjetjeA.type).toBe('podjetje')

    expect(res.body.edges).toHaveLength(2)
    expect(res.body.edges[0].vloga).toBe('direktor')
    expect(res.body.edges[1].vloga).toBe('lastnik')
  })

  test('BFS depth 2: podjetja → osebe se poveže nazaj', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Janez', priimek: 'Novak' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{ oseba_id: 1, podjetje_id: 10, popolno_ime: 'Podjetje A', vloga: 'direktor' }]
    })
    mockQuery.mockResolvedValueOnce({
      rows: [{ podjetje_id: 10, oseba_id: 2, ime: 'Maja', priimek: 'Horvat', vloga: 'zastopnik' }]
    })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/omrezje/1')

    expect(res.status).toBe(200)

    const maja = res.body.nodes.find(n => n.name === 'Maja Horvat')
    expect(maja).toBeDefined()
    expect(maja.type).toBe('oseba')
  })

  test('edges ne vsebujejo polja key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{ oseba_id: 1, podjetje_id: 10, popolno_ime: 'Firma X', vloga: 'direktor' }]
    })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/omrezje/1')

    for (const edge of res.body.edges) {
      expect(edge).not.toHaveProperty('key')
      expect(edge).toHaveProperty('from')
      expect(edge).toHaveProperty('to')
      expect(edge).toHaveProperty('vloga')
    }
  })

  test('podvojena podjetja se ne dodajo dvakrat v nodes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Janez', priimek: 'Novak' }] })
    mockQuery.mockResolvedValueOnce({
      rows: [
        { oseba_id: 1, podjetje_id: 10, popolno_ime: 'Podjetje A', vloga: 'direktor' },
        { oseba_id: 1, podjetje_id: 10, popolno_ime: 'Podjetje A', vloga: 'lastnik' }
      ]
    })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/omrezje/1')

    const podjetjaNodes = res.body.nodes.filter(n => n.id === 10)
    expect(podjetjaNodes).toHaveLength(1)
  })


  test('privzeta globina je 3', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
    mockQuery.mockResolvedValue({ rows: [] })

    const res = await request(app).get('/omrezje/1')

    expect(res.body.maxDepth).toBe(3)
  })

  test('depth parameter se upošteva', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
    mockQuery.mockResolvedValue({ rows: [] })

    const res = await request(app).get('/omrezje/1?depth=2')

    expect(res.body.maxDepth).toBe(2)
  })

  test('depth je omejen na max 6', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, ime: 'Ana', priimek: 'Kovač' }] })
    mockQuery.mockResolvedValue({ rows: [] })

    const res = await request(app).get('/omrezje/1?depth=99')

    expect(res.body.maxDepth).toBe(6)
  })


  test('vrne 500 ob napaki baze', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB napaka'))

    const res = await request(app).get('/omrezje/1')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('DB napaka')
  })
})