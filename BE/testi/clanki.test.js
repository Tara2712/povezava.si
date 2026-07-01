const express = require('express');
const request = require('supertest');
const createClankiRouter = require('../routes/clanki');

describe('GET /clanki', () => {
  let app;
  let pool;

  beforeEach(() => {
    pool = {
      query: jest.fn(),
    };

    app = express();
    app.use('/clanki', createClankiRouter(pool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('vrne clanke brez search query', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            naslov: 'Test Article',
            url: 'https://example.com',
            vir: 'Example',
            datum: '2024-01-01',
            povzetek: 'Summary',
            osebe: [
              {
                id: 1,
                ime: 'John',
                priimek: 'Doe',
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

    const res = await request(app).get('/clanki');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      skupaj: 1,
      clanki: [
        {
          id: 1,
          naslov: 'Test Article',
          url: 'https://example.com',
          vir: 'Example',
          datum: '2024-01-01',
          povzetek: 'Summary',
          osebe: [
            {
              id: 1,
              ime: 'John',
              priimek: 'Doe',
            },
          ],
        },
      ],
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('uporabi search query ko je podana', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

    const res = await request(app).get('/clanki?q=test');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      skupaj: 0,
      clanki: [],
    });

    // SELECT
    expect(pool.query.mock.calls[0][1]).toEqual([
      '%test%',
      8,
      0,
    ]);

    // COUNT
    expect(pool.query.mock.calls[1][1]).toEqual([
      '%test%',
    ]);
  });

  test('vrne clanke z limit in offset', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

    const res = await request(app).get('/clanki?limit=5&offset=10');

    expect(res.status).toBe(200);

    expect(pool.query.mock.calls[0][1]).toEqual([
      5,
      10,
    ]);
  });

  test('omejitev 100 clankov', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

    await request(app).get('/clanki?limit=500');

    expect(pool.query.mock.calls[0][1]).toEqual([
      100,
      0,
    ]);
  });

  test('vrne 500 ko baza vrne napako', async () => {
    pool.query.mockRejectedValue(new Error('Database failed'));

    const res = await request(app).get('/clanki');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Database failed',
    });
  });
});