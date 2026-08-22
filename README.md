# Povezava.si

### Commit sporočila

Sporočila pišemo v **slovenščini** in obvezno vključimo Jira identifikator.

**Format:**

```
PROJ-XX Kratek opis spremembe
```

**Primeri:**

```
PROJ-1 Dodano zbiranje podatkov iz OPSI API-ja
```

**Pravila:**

- Opis naj bo jasen in konkreten — ne "popravki" ali "spremembe"
- Piši v pretekliku (Dodano, Implementirano, Popravljeno)
- En commit = ena logična sprememba

---

### Standardi kodiranja

Koda se piše v **angleščini** v vseh komponentah.

| Kontekst                                     | Konvencija       | Primer                     |
| -------------------------------------------- | ---------------- | -------------------------- |
| Spremenljivke in funkcije (JavaScript)       | camelCase        | `primerPrimer`             |
| Razredi (JavaScript)                         | PascalCase       | `PrimerPrimer`             |
| Konstante                                    | UPPER_SNAKE_CASE | `PRIMER_PRIMER`            |
| Komponente in datoteke komponent (frontend)  | PascalCase       | `MainPrimer.jsx`           |
| Ostale datoteke (frontend)                   | camelCase        | `primerPrimer.js`          |
| Spremenljivke in funkcije (Python)           | snake_case       | `primer_primer`            |
| Datoteke (Python)                            | snake_case       | `primer_primer.py`         |

---

### Strategija vej

| Veja          | Namen                                      |
| ------------- | ------------------------------------------ |
| `main`        | Produkcijska veja — samo stabilna koda     |
| `development` | Aktivni razvoj — sem mergamo vse spremembe |

**Pravila:**

- Nikoli ne pushaj direktno na `main`
- Vse spremembe gredo prek `development`
- Za vsak feature ali popravek ustvari svojo vejo iz `development`

**Format imen vej:**

```
feat/PROJ-XX-kratek-opis
fix/PROJ-XX-kratek-opis
```

---
