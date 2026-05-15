import requests
from bs4 import BeautifulSoup
import csv
import time
import re

BASE_URL = "https://profesorji.net"

TARGET_UNIS = {
    "Univerza v Ljubljani",
    "Univerza v Mariboru",
    "Univerza na Primorskem"
}

def get_soup(url):
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    r.encoding = "utf-8"
    return BeautifulSoup(r.text, "html.parser")

soup = get_soup(BASE_URL)
rezultati = []

for h1 in soup.find_all("h1"):
    univerza = h1.get_text(strip=True)
    if univerza not in TARGET_UNIS:
        continue

    ul = h1.find_next("ul")
    if not ul:
        continue

    for a in ul.find_all("a", href=True):
        if not a["href"].startswith("/fakulteta/"):
            continue

        f_url = BASE_URL + a["href"]
        f_ime = a.get_text(strip=True)
        print(f"Fakulteta: {f_ime}")

        try:
            f_soup = get_soup(f_url)
            time.sleep(0.3)

            smeri = f_soup.find_all("a", href=re.compile(r"^/fakulteta/[^/]+/[^/]+$"))

            for smer_link in smeri:
                smer_url = BASE_URL + smer_link["href"]
                smer_ime = smer_link.get_text(strip=True)
                print(f"  Smer: {smer_ime}")

                try:
                    s_soup = get_soup(smer_url)
                    time.sleep(0.3)

                    for prof_a in s_soup.find_all("a", href=re.compile(r"^/profesor/")):
                        ime_priimek = prof_a.get_text(strip=True)
                        if not ime_priimek:
                            continue
                        parts = ime_priimek.split()
                        if len(parts) < 2:
                            continue
                        priimek = parts[0]
                        ime = " ".join(parts[1:])
                        rezultati.append([univerza, f_ime, smer_ime, ime, priimek])

                except Exception as e:
                    print(f"    Napaka smer {smer_url}: {e}")

        except Exception as e:
            print(f"  Napaka fakulteta {f_url}: {e}")

# Odstrani duplikate
rezultati = list({(r[0],r[1],r[2],r[3],r[4]): r for r in rezultati}.values())

with open("profesorji.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["Univerza", "Fakulteta", "Smer", "Ime", "Priimek"])
    writer.writerows(rezultati)

print(f"Končano! {len(rezultati)} profesorjev shranjenih v profesorji.csv")