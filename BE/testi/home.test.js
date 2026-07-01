const express = require('express');
const request = require('supertest');
const createHomeRouter = require('../routes/home');

describe('GET /home', () => {
  let app;
  let pool;

  beforeEach(() => {
    pool = {
      query: jest.fn(),
    };

    app = express();
    app.use('/home', createHomeRouter(pool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Vrne vse podatke', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            ime: 'John',
            priimek: 'Doe',
            stevilo_povezav: '5',
          },
        ],
      }) // top poslovnezi
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            ime: 'Jane',
            priimek: 'Smith',
          },
        ],
      }) // top akademiki
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            naslov: 'News',
          },
        ],
      }) // clanki
      .mockResolvedValueOnce({
        rows: [
          {
            osebe: '100',
            podjetja: '20',
            povezave: '300',
          },
        ],
      }) // stats
      .mockResolvedValueOnce({
        rows: [{ skupaj: '7' }],
      }) // lobisti
      .mockResolvedValueOnce({
        rows: [{ skupaj: '4' }],
      }); // ovadeni

    const res = await request(app).get('/home');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      topPoslovnezi: [
        {
          id: 1,
          ime: 'John',
          priimek: 'Doe',
          stevilo_povezav: '5',
        },
      ],
      topAkademiki: [
        {
          id: 2,
          ime: 'Jane',
          priimek: 'Smith',
        },
      ],
      clanki: [
        {
          id: 1,
          naslov: 'News',
        },
      ],
      stats: {
        osebe: '100',
        podjetja: '20',
        povezave: '300',
      },
      lobCount: 7,
      ovCount: 4,
    });

    expect(pool.query).toHaveBeenCalledTimes(6);
  });

  test('uporabi cache na drugi zahtevi', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2 }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 3 }],
      })
      .mockResolvedValueOnce({
        rows: [{ osebe: '1', podjetja: '2', povezave: '3' }],
      })
      .mockResolvedValueOnce({
        rows: [{ skupaj: '4' }],
      })
      .mockResolvedValueOnce({
        rows: [{ skupaj: '5' }],
      });

    const first = await request(app).get('/home');
    const second = await request(app).get('/home');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect(pool.query).toHaveBeenCalledTimes(6);

    expect(second.body).toEqual(first.body);
  });

  test('privzeto število 0, če manjkajo vrednosti', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{}],
      })
      .mockResolvedValueOnce({
        rows: [{}],
      })
      .mockResolvedValueOnce({
        rows: [{}],
      });

    const res = await request(app).get('/home');

    expect(res.status).toBe(200);

    expect(res.body.lobCount).toBe(0);
    expect(res.body.ovCount).toBe(0);
  });

  test('vrne 500 če baza vrne napako', async () => {
    pool.query.mockRejectedValue(new Error('Database error'));

    const res = await request(app).get('/home');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Database error',
    });
  });
});