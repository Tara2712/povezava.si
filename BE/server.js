const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// endpointi
const podjetjaRouter = require('./routes/podjetja')
app.use('/api/podjetja', podjetjaRouter)

app.get('/api/test', (req, res) => { // test, če baza dela na renderju
  res.json({ message: 'Test endpoint deluje' })
});
//test verzije na renderju
app.get('/api/version', (req, res) => {
  res.json({
    version: '2026-05-11-1',
    message: 'Render uporablja novo verzijo server.js'
  })
})

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Povezava.si backend deluje!' });
});

app.listen(PORT, () => {
  console.log(`Server teče na portu ${PORT}`);
});