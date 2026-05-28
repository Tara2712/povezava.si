require('dotenv').config()
const express = require('express')
const { setupRoutes } = require('./routes/gemini_ai')

const app = express()

app.use(express.json())

setupRoutes(app)

app.listen(3001, () => {
  console.log('Test Gemini server teče na http://localhost:3001')
})