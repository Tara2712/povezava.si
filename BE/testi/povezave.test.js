const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockQuery,
  })),
}));

const router = require('../routes/povezave'); 

describe('GET /povezave', () => {
  let app;

  beforeEach(() => {
    mockQuery.mockReset();

    app = express();
    app.use('/povezave', router);
  });

  test('vrne vse povezave', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 1,
          vloga: 'CEO',
          ime: 'John',
          priimek: 'Doe',
          podjetje: 'OpenAI',
        },
        {
          id: 2,
          vloga: 'CTO',
          ime: 'Jane',
          priimek: 'Smith',
          podjetje: 'Microsoft',
        },
      ],
    });

    const res = await request(app).get('/povezave');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        vloga: 'CEO',
        ime: 'John',
        priimek: 'Doe',
        podjetje: 'OpenAI',
      },
      {
        id: 2,
        vloga: 'CTO',
        ime: 'Jane',
        priimek: 'Smith',
        podjetje: 'Microsoft',
      },
    ]);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain('SELECT');
    expect(mockQuery.mock.calls[0][0]).toContain('FROM povezave');
  });

  test('vrne prazen array če ni povezav', async () => {
    mockQuery.mockResolvedValue({
      rows: [],
    });

    const res = await request(app).get('/povezave');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('vrne 500 če baza vrne napako', async () => {
    mockQuery.mockRejectedValue(new Error('Database error'));

    const res = await request(app).get('/povezave');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Database error',
    });
  });
});