/**
 * Debug skripta — izpiše izrisani HTML strani ii.feri.um.si/osebje
 * Zaženite: node scripts/debugFeri.js
 */
require('dotenv').config()

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL    = 'https://ii.feri.um.si/sl/o-institutu/osebje/'

async function main() {
  const { default: puppeteer } = await import('puppeteer-core')

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  console.log('Nalagam stran...')
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))

  // Izpiši vse img elemente z alt in src
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('img')].map(i => ({
      alt: i.alt,
      src: i.src,
      parentTag: i.parentElement?.tagName,
      parentClass: i.parentElement?.className?.slice(0, 60),
      grandparentTag: i.parentElement?.parentElement?.tagName,
      grandparentClass: i.parentElement?.parentElement?.className?.slice(0, 60),
    }))
  )

  console.log('\n=== VSE SLIKE NA STRANI ===')
  imgs.forEach((img, i) => console.log(`${i}. alt="${img.alt}" | parent=${img.parentTag}.${img.parentClass} | grand=${img.grandparentTag}.${img.grandparentClass}\n   src=${img.src.slice(0, 80)}`))

  // Izpiši strukturo vsebinskega dela
  const vsebina = await page.evaluate(() => {
    const el = document.querySelector('.entry-content, main, article, #content, .page-content')
    return el ? el.innerHTML.slice(0, 8000) : 'NI NAJDEN vsebinski element'
  })

  console.log('\n=== VSEBINA (prvih 8000 znakov) ===')
  console.log(vsebina)

  await browser.close()
}

main().catch(e => { console.error(e.message); process.exit(1) })
