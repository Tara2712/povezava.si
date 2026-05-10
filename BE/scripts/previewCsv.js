const https = require('https')

const CSV_URL = 'https://podatki.gov.si/dataset/9ee1a9aa-c224-4995-b2ad-3760d7af0748/resource/beb70929-3d0d-41c6-9af2-25d525d906d3/download/opsiprs.csv'

https.get(CSV_URL, (res) => {
  let data = ''
  let lineCount = 0

  res.on('data', chunk => {
    data += chunk
    const lines = data.split('\n')
    
    if (lines.length > 6) {
      // Pokažite prvih 6 vrstic (header + 5 podatkov)
      lines.slice(0, 6).forEach(line => console.log(line))
      res.destroy()
    }
  })

  res.on('end', () => {
    process.exit()
  })

  res.on('close', () => {
    process.exit()
  })
})