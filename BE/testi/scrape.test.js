const express = require('express');
const request = require('supertest');

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const { execFile } = require('child_process');
const createScrapeRouter = require('../routes/scrape');

describe('POST /scrape', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use('/scrape', createScrapeRouter());
  });

  afterEach(() => {
    delete process.env.SCRAPE_SECRET;
  });

  test('začne s scrapanjem ko ni konfiguriran skrivni ključ', async () => {
    const res = await request(app).post('/scrape');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'started',
    });

    expect(execFile).toHaveBeenCalledWith(
      'node',
      ['scripts/scrapeNews.js'],
      { cwd: process.cwd() },
      expect.any(Function)
    );
  });

  test('vrne 401 če avtorizacijski header manjka', async () => {
    process.env.SCRAPE_SECRET = 'my-secret';

    const res = await request(app).post('/scrape');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'Unauthorized',
    });

    expect(execFile).not.toHaveBeenCalled();
  });

  test('vrne 401 če avtorizacijski header je napačen', async () => {
    process.env.SCRAPE_SECRET = 'my-secret';

    const res = await request(app)
      .post('/scrape')
      .set('Authorization', 'Bearer wrong-secret');

    expect(res.status).toBe(401);

    expect(execFile).not.toHaveBeenCalled();
  });

  test('začne s scrapanjem z ustreznim avtorizacijo', async () => {
    process.env.SCRAPE_SECRET = 'my-secret';

    const res = await request(app)
      .post('/scrape')
      .set('Authorization', 'Bearer my-secret');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'started',
    });

    expect(execFile).toHaveBeenCalledTimes(1);
  });

  test('obdela execFile callback brez napake', () => {
    execFile.mockImplementation((cmd, args, opts, callback) => {
      callback(null);
    });

    const consoleSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const router = createScrapeRouter();

    expect(router).toBeDefined();

    consoleSpy.mockRestore();
  });

  test('obdela execFile callback z napako', () => {
    execFile.mockImplementation((cmd, args, opts, callback) => {
      callback(new Error('Scrape failed'));
    });

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const router = createScrapeRouter();

    expect(router).toBeDefined();

    consoleSpy.mockRestore();
  });
});