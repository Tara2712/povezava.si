import csv
from collections import defaultdict

with open("profesorji.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    vrstice = list(reader)

# najdi duplikate
videni = defaultdict(set)
unikatni = []
duplikati = 0

for v in vrstice:
    kljuc = (v["Fakulteta"], v["Ime"], v["Priimek"])
    if kljuc not in videni:
        videni[kljuc].add(kljuc)
        unikatni.append(v)
    else:
        duplikati += 1
        print(f"Duplikat: {v['Ime']} {v['Priimek']} - {v['Fakulteta']}")

print(f"\nSkupaj: {len(vrstice)}, Duplikati: {duplikati}, Unikatni: {len(unikatni)}")

# Duplikati
with open("profesorji.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["Univerza", "Fakulteta", "Ime", "Priimek"])
    writer.writeheader()
    writer.writerows(unikatni)

print("Shranjeno!")