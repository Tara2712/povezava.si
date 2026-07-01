const express = require('express');
const request = require('supertest');
const createPotRouter = require('../routes/pot'); 

describe('GET /pot', () => {
  let app;
  let pool;

  beforeEach(() => {
    pool = {
      query: jest.fn(),
    };

    app = express();
    app.use('/pot', createPotRouter(pool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('vrne 400 če parametri manjkajo', async () => {
    const res = await request(app).get('/pot');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Manjkata parametra od in do',
    });
  });

  test('vrne 404 če začetna oseba ni najdena', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // start person
      .mockResolvedValueOnce({
        rows: [{ id: 2, ime: 'Jane', priimek: 'Doe' }],
      });

    const res = await request(app).get('/pot?od=1&do=2');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Začetna oseba ni najdena',
    });
  });

  test('vrne 404 če končna oseba ni najdena', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'John', priimek: 'Doe' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/pot?od=1&do=2');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Končna oseba ni najdena',
    });
  });

  test('vrne pot ko sta začetna in končna oseba sta enaki', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'John', priimek: 'Doe' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'John', priimek: 'Doe' }],
      });

    const res = await request(app).get('/pot?od=1&do=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      path: [
        {
          type: 'oseba',
          id: 1,
          name: 'John Doe',
        },
      ],
      stopnje: 0,
    });
  });

  test('vrne pot med dvema osebama', async () => {
    pool.query
      // start person
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'John', priimek: 'Doe' }],
      })
      // end person
      .mockResolvedValueOnce({
        rows: [{ id: 2, ime: 'Jane', priimek: 'Smith' }],
      })
      // person -> company
      .mockResolvedValueOnce({
        rows: [
          {
            oseba_id: 1,
            podjetje_id: 10,
            popolno_ime: 'OpenAI',
            vloga: 'Engineer',
          },
        ],
      })
      // company -> person
      .mockResolvedValueOnce({
        rows: [
          {
            podjetje_id: 10,
            oseba_id: 2,
            ime: 'Jane',
            priimek: 'Smith',
            vloga: 'Manager',
          },
        ],
      });

    const res = await request(app).get('/pot?od=1&do=2');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      path: [
        {
          type: 'oseba',
          id: 1,
          name: 'John Doe',
        },
        {
          type: 'podjetje',
          id: 10,
          name: 'OpenAI',
          vloga: 'Engineer',
        },
        {
          type: 'oseba',
          id: 2,
          name: 'Jane Smith',
          vloga: 'Manager',
        },
      ],
      stopnje: 1,
    });
  });

  test('vrne null pot če povezava med osebami ne obstaja', async () => {
    pool.query
      // start
      .mockResolvedValueOnce({
        rows: [{ id: 1, ime: 'John', priimek: 'Doe' }],
      })
      // end
      .mockResolvedValueOnce({
        rows: [{ id: 2, ime: 'Jane', priimek: 'Smith' }],
      })
      // first BFS query finds nothing
      .mockResolvedValueOnce({
        rows: [],
      });

    const res = await request(app).get('/pot?od=1&do=2');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      path: null,
      stopnje: null,
      sporocilo:
        'Pot med John Doe in Jane Smith ni bila najdena v 6 stopnjah ločenosti.',
    });
  });

  test('vrne 500 če baza vrne napako', async () => {
    pool.query.mockRejectedValue(new Error('Database error'));

    const res = await request(app).get('/pot?od=1&do=2');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Database error',
    });
  });
});