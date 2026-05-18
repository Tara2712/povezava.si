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

  await page.goto('https://ii.feri.um.si/sl/o-institutu/osebje/', { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('.staff_image_border', { timeout: 15000 })
  await new Promise(r => setTimeout(r, 1000))

  const result = await page.evaluate(() => {
    return [...document.querySelectorAll('.staff_image_border')].slice(0, 3).map(card => {
      // Traverse up to find parent link or sibling link
      let el = card
      let parentLink = null
      for (let i = 0; i < 5; i++) {
        el = el.parentElement
        if (!el) break
        if (el.tagName === 'A') { parentLink = el.href; break }
        const a = el.querySelector('a')
        if (a) { parentLink = a.href; break }
      }
      const img = card.querySelector('img')
      // Also check nearby elements for name + link
      const nameEl = card.closest('[class]')?.querySelector('.staff_name, .cont_name, h2, h3, .name')
      return {
        alt: img?.alt,
        parentLink,
        nearParentClass: card.parentElement?.className,
        nearParentGrandClass: card.parentElement?.parentElement?.className,
        nearParentHTML: card.parentElement?.outerHTML?.slice(0, 500),
      }
    })
  })

  console.log(JSON.stringify(result, null, 2))
  await browser.close()
}

main().catch(e => console.error(e.message))
