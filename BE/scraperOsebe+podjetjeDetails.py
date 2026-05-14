# !pip install playwright

# !pip install playwright
# !playwright install chromium
# !playwright install-deps

import asyncio
import pandas as pd
import random
from playwright.async_api import async_playwright
import nest_asyncio

VHODNA_DATOTEKA = "opsiprs.csv"
IZHODNA_DATOTEKA = "ajpes_osebe.csv"

AJPES_URL = "https://www.ajpes.si/"


# LOGIN
async def handle_login(page):

    try:

        login_btn = page.locator(
            "a.btn.btn-warning:has-text('PRIJAVA V SISTEM')"
        )

        if await login_btn.count() > 0:

            print("   [!] LOGIN potreben")

            await login_btn.first.click()

            await page.wait_for_timeout(3000)

            # anonimni uporabnik
            anon = page.locator(
                "text=Vstopi kot anonimni uporabnik"
            )

            await anon.wait_for(
                state="visible",
                timeout=10000
            )

            print("   [!] Klik anonimni uporabnik")

            await anon.click()

            await page.wait_for_timeout(2000)

            # gumb v popup oknu
            nadaljuj = page.locator(
                "button.btn.btn-success:has-text('Nadaljuj s prijavo')"
            )

            await nadaljuj.wait_for(
                state="visible",
                timeout=10000
            )

            print("   [!] Klik Nadaljuj s prijavo")

            await nadaljuj.click()

            # počakamo login
            await page.wait_for_timeout(6000)

        # preverimo login
        osnovni_podatki = page.locator(
            "h4:has-text('OSNOVNI PODATKI')"
        )

        if await osnovni_podatki.count() > 0:

            print("   [+] Login uspešen")

            return True

        else:

            print("   [!] Login neuspešen")

            return False

    except Exception as e:

        print(f"   [!] LOGIN ERROR: {e}")

        return False


# Search podjetje
async def search_company(page, maticna):

    try:

        await page.goto(
            AJPES_URL,
            wait_until="domcontentloaded"
        )

        await page.wait_for_timeout(2000)

        # search input
        search_input = page.locator(
            "#prva_OsnovnoIskanje"
        )

        await search_input.wait_for(
            state="visible",
            timeout=10000
        )

        # vnos matične
        await search_input.fill(str(maticna))

        await page.wait_for_timeout(1000)

        # klik išči
        await page.locator(
            "input[type='submit'][value='IŠČI']"
        ).first.click()

        await page.wait_for_load_state(
            "domcontentloaded"
        )

        await page.wait_for_timeout(4000)

        print("   [i] URL:", page.url)

        await handle_login(page)

        await page.wait_for_timeout(3000)

        return True

    except Exception as e:

        print(
            f"   [!] Napaka pri iskanju {maticna}: {e}"
        )

        return False


# scraper
async def scrape_osebe(page, maticna):

    try:

        company_data = {
            "Matična številka podjetja": maticna,
            "Telefon": "",
            "Email": "",
            "Datum vpisa": "",
            "Status aktivnosti": "",
            "Velikost": "",
            "Glavna dejavnost": "",
            "Druge dejavnosti": "",
            "Zastopniki": "",
            "Ustanovitelji": "",
            "Lastniki": "",
            "Prokurist": "",
            "Družbeniki": "",
            "Direktor": "",
            "Uprava": "",
            "Člani nadzornega sveta": "",
            "Nosilec dejavnosti": "",
            "Partnerji": ""
        }

        rows = page.locator("div.row")

        count = await rows.count()

        for i in range(count):

            row = rows.nth(i)

            try:

                label_el = row.locator(
                    "div.col-sm-5.text-thin"
                )

                if await label_el.count() == 0:
                    continue

                label = (
                    await label_el.first.inner_text()
                ).strip()

                if not label:
                    continue

                value_el = row.locator(
                    "div.col-sm-7"
                )

                if await value_el.count() == 0:
                    continue

                text = (
                    await value_el.first.inner_text()
                ).strip()

                if not text:
                    continue

                cleaned = " | ".join([
                    t.strip()
                    for t in text.split("\n")
                    if t.strip()
                ])

                print(f"   + {label}: {cleaned}")

                if label == "Telefon":

                    if company_data["Telefon"]:
                        company_data["Telefon"] += " | " + cleaned
                    else:
                        company_data["Telefon"] = cleaned

                elif label == "Elektronski naslov":

                    company_data["Email"] = cleaned

                elif label in [
                    "Datum vpisa",
                    "Status aktivnosti",
                    "Velikost",
                    "Glavna dejavnost"
                ]:

                    company_data[label] = cleaned

                elif label == "Druge dejavnosti":

                    if company_data["Druge dejavnosti"]:
                        company_data["Druge dejavnosti"] += " | " + cleaned
                    else:
                        company_data["Druge dejavnosti"] = cleaned

                # Vse vloge
                else:

                    if label not in company_data:

                        company_data[label] = cleaned

                    else:

                        if company_data[label]:
                            company_data[label] += " | " + cleaned
                        else:
                            company_data[label] = cleaned

            except:
                continue

        return [company_data]

    except Exception as e:

        print(f"   [!] ERROR {maticna}: {e}")

        return []

async def main():

    try:

        df = pd.read_csv(
            VHODNA_DATOTEKA,
            encoding="utf-8-sig"
        )

    except:

        df = pd.read_csv(
            VHODNA_DATOTEKA,
            encoding="utf-16-le"
        )

    print(f"Naloženih vrstic: {len(df)}")

    async with async_playwright() as p:

        browser = await p.chromium.launch(
            headless=True
        )

        context = await browser.new_context()

        page = await context.new_page()

        all_data = []

        for i, row in df.iterrows():

            await context.clear_cookies()

            maticna = str(
                row["Matična številka"]
            ).strip()

            print(
                f"\n--- ({i+1}/{len(df)}) {maticna} ---"
            )

            found = await search_company(
                page,
                maticna
            )

            if found:

                data = await scrape_osebe(
                    page,
                    maticna
                )

                all_data.extend(data)

            else:

                print(
                    "   [!] Podjetje ni bilo najdeno"
                )

            # vmesni save
            if i % 20 == 0 and all_data:

                pd.DataFrame(all_data).to_csv(
                    IZHODNA_DATOTEKA,
                    index=False,
                    encoding="utf-8-sig"
                )

                print(
                    f"   >>> vmesno shranjeno ({len(all_data)})"
                )

            await asyncio.sleep(
                random.uniform(1, 2)
            )

        # final save
        pd.DataFrame(all_data).to_csv(
            IZHODNA_DATOTEKA,
            index=False,
            encoding="utf-8-sig"
        )

        print(
            f"\nKONČANO → skupaj zapisov: {len(all_data)}"
        )

        await browser.close()


if __name__ == "__main__":

    nest_asyncio.apply()

    asyncio.run(main())