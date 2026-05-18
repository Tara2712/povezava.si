const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function main() {
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'sl-SI,sl;q=0.9' })

  // Use correct URL pattern
  await page.goto('https://ii.feri.um.si/sl/person/marjan-hericko/', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2000))

  const result = await page.evaluate(() => {
    const sc = document.querySelector('.single_contact_content')
    if (!sc) return { error: 'no single_contact_content', title: document.title }

    // Get categ (role)
    const categ = sc.querySelector('.cont_categ')?.textContent?.trim()

    // Find 'Glavna področja' heading and collect LI items
    let podrocja = null
    const headings = sc.querySelectorAll('h2, h3, h4')
    for (const h of headings) {
      const txt = h.textContent.toLowerCase()
      if (txt.includes('področj') || txt.includes('research') || txt.includes('razisk')) {
        let items = []
        let el = h.nextElementSibling
        while (el && !['H2', 'H3', 'H4'].includes(el.tagName)) {
          const lis = el.tagName === 'UL' || el.tagName === 'OL'
            ? [...el.querySelectorAll('li')].map(li => li.textContent.trim())
            : [el.textContent.trim()]
          items.push(...lis.filter(Boolean))
          el = el.nextElementSibling
        }
        if (items.length) { podrocja = items.join(' · ').slice(0, 500); break }
      }
    }

    return { categ, podrocja }
  })

  console.log(JSON.stringify(result, null, 2))
  await browser.close()
}

main().catch(e => console.error(e.message))
