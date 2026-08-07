const request = require('supertest')
const express = require('express')

const TEST_EMAIL = 'test@test.com'
const GMAIL_USER = 'test@gmail.com'
const GMAIL_PASS = 'geslo'

const mockSendMail = jest.fn()

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail
  }))
}))

jest.mock('node-cron', () => ({
  schedule: jest.fn()
}))

jest.mock('dotenv', () => ({
  config: jest.fn()
}))

const nodemailer = require('nodemailer')
const cron = require('node-cron')
const makeWatchlistRouter = require('../routes/watchlist')

const mockQuery = jest.fn()

function buildApp() {
  const app = express()

  app.use(express.json())

  app.use(
    '/api/watchlist',
    makeWatchlistRouter({
      query: mockQuery
    })
  )

  return app
}

function enableGmail() {
  process.env.GMAIL_USER = GMAIL_USER
  process.env.GMAIL_PASS = GMAIL_PASS
}

function disableGmail() {
  delete process.env.GMAIL_USER
  delete process.env.GMAIL_PASS
}

function resetTestState() {
  jest.clearAllMocks()

  mockQuery.mockReset()

  mockSendMail.mockReset()
  mockSendMail.mockResolvedValue({})

  disableGmail()
}

function getWatchlist(app, email = TEST_EMAIL) {
  return request(app)
    .get('/api/watchlist')
    .query({ email })
}

function postWatchlist(app, body = {}) {
  return request(app)
    .post('/api/watchlist')
    .send(body)
}

function deleteWatchlist(app, body = {}) {
  return request(app)
    .delete('/api/watchlist')
    .send(body)
}

function mockNewFollow({
  id = 99,
  ime = 'Ana',
  priimek = 'Kovač'
} = {}) {
  mockQuery
    .mockResolvedValueOnce({
      rows: [{ id }]
    })
    .mockResolvedValueOnce({
      rows: [{ ime, priimek }]
    })
}

function normalizeSql(sql) {
  return sql
    .replace(/\s+/g, ' ')
    .trim()
}

function getQueryCall(index = 0) {
  const [sql, params] =
    mockQuery.mock.calls[index]

  return {
    sql: normalizeSql(sql),
    params
  }
}

function flushPromises() {
  return new Promise(resolve =>
    setImmediate(resolve)
  )
}

function registerCronJob() {
  enableGmail()

  makeWatchlistRouter({
    query: mockQuery
  })

  expect(cron.schedule).toHaveBeenCalledWith(
    '0 8 * * *',
    expect.any(Function)
  )

  return cron.schedule.mock.calls[0][1]
}

module.exports = {
  TEST_EMAIL,
  GMAIL_USER,
  GMAIL_PASS,
  mockSendMail,
  mockQuery,
  nodemailer,
  cron,
  buildApp,
  enableGmail,
  disableGmail,
  resetTestState,
  getWatchlist,
  postWatchlist,
  deleteWatchlist,
  mockNewFollow,
  normalizeSql,
  getQueryCall,
  flushPromises,
  registerCronJob,
  makeWatchlistRouter
}