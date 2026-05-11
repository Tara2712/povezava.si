const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  next()
})


app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Povezava.si backend deluje!' });
});





app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});