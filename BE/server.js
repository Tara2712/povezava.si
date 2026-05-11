const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
const podjetjaRouter = require('./routes/podjetja')
app.use('/api/podjetja', podjetjaRouter)


app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Povezava.si backend deluje!' });
});

app.listen(PORT, () => {
  console.log(`Server teče na portu ${PORT}`);
});