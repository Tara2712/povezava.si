const express = require('express');
const request = require('supertest');

jest.mock('openai');
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(),
}));

jest.mock('../utils/dbHelpers', () => ({
  lookupPersonInDB: jest.fn(),
  searchWeb: jest.fn(),
  fetchProfilData: jest.fn(),
  normStr: jest.fn((s) => s),
  stemStr: jest.fn((s) => s),
}));

const OpenAI = require('openai');
const { lookupPersonInDB } = require('../utils/dbHelpers');

const createRouter = require('../routes/ai');

describe('POST /ai/vprasaj', () => {
  let app;
  let pool;

  beforeEach(() => {
    pool = {
      query: jest.fn(),
    };

    app = express();
    app.use(express.json());
    app.use('/ai', createRouter(pool));

    jest.clearAllMocks();
  });

  test('vrne 400 če vprašanje manjka', async () => {
    const res = await request(app)
      .post('/ai/vprasaj')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Manjka vprašanje',
    });
  });

  test('vrne SSE response', async () => {
    const stream = (async function* () {
      yield {
        choices: [
          {
            delta: {
              content: 'Pozdrav!',
            },
          },
        ],
      };
    })();

    const createMock = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              tool_calls: [],
            },
          },
        ],
      })
      .mockResolvedValueOnce(stream);

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: createMock,
        },
      },
    }));

    const res = await request(app)
      .post('/ai/vprasaj')
      .send({
        vprasanje: 'Živjo',
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('"chunk":"Pozdrav!"');
    expect(res.text).toContain('"done":true');
  });

  test('calls lookup_person tool', async () => {
    lookupPersonInDB.mockResolvedValue({
      osebe: [
        {
          id: 1,
          ime: 'Janez',
          priimek: 'Novak',
        },
      ],
      summary: 'Najden.',
    });

    const stream = (async function* () {
      yield {
        choices: [
          {
            delta: {
              content: 'To je odgovor.',
            },
          },
        ],
      };
    })();

    const createMock = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: '1',
                  function: {
                    name: 'lookup_person',
                    arguments: JSON.stringify({
                      name: 'Janez Novak',
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce(stream);

    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: createMock,
        },
      },
    }));

    pool.query.mockResolvedValue({
      rows: [],
    });

    const res = await request(app)
      .post('/ai/vprasaj')
      .send({
        vprasanje: 'Kdo je Janez Novak?',
      });

    expect(res.status).toBe(200);

    expect(lookupPersonInDB).toHaveBeenCalledWith(
      'Janez Novak',
      pool
    );

    expect(res.text).toContain('"done":true');
  });

});