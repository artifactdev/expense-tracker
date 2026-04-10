# KI-Funktionen

Der Expense Tracker verfügt über optionale KI-gestützte Features, die über einen OpenAI-kompatiblen Endpunkt kommunizieren. Die Konfiguration erfolgt unter **Dashboard → Settings → AI**.

---

## Konfiguration

### Einstellungsseite

Unter `/dashboard/settings/ai` können alle KI-Parameter konfiguriert werden:

| Einstellung                    | Beschreibung                                                           |
| ------------------------------ | ---------------------------------------------------------------------- |
| **Enable AI**                  | Haupt-Schalter — aktiviert/deaktiviert alle KI-Features                |
| **OpenAI-compatible Endpoint** | Basis-URL der API (z. B. `https://api.openai.com/v1`)                  |
| **Model**                      | Modell-Bezeichner (z. B. `gpt-4o-mini`, `llama3`, `mistral`)           |
| **API Key**                    | API-Schlüssel — wird lokal in der DB gespeichert, nicht weitergeleitet |
| **AI-assisted Categorization** | KI schlägt Kategorien für neue Transaktionen vor                       |
| **AI Subscription Detection**  | KI bewertet algorithmisch erkannte Abo-Kandidaten                      |
| **System Prompt**              | Optionaler Kontext für personalisierte Kategorisierung                 |

### Kompatible Dienste / Modelle

| Dienst            | Endpoint                                                              | Modell-Beispiel                               |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| OpenAI            | `https://api.openai.com/v1`                                           | `gpt-4o-mini`, `gpt-4o`                       |
| Azure OpenAI      | `https://<resource>.openai.azure.com/openai/deployments/<deployment>` | `gpt-4o`                                      |
| Ollama (lokal)    | `http://localhost:11434/v1`                                           | `llama3.2`, `mistral`                         |
| LM Studio (lokal) | `http://localhost:1234/v1`                                            | beliebig                                      |
| Groq              | `https://api.groq.com/openai/v1`                                      | `llama-3.3-70b-versatile`                     |
| Together AI       | `https://api.together.xyz/v1`                                         | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` |

---

## Feature 1: KI-gestützte Kategorisierung

### Einzelne Transaktion

Beim manuellen Erfassen einer Transaktion erscheint ein **"AI suggest"**-Button (Bot-Icon) im Kategoriefeld, sobald `AI-assisted Categorization` aktiviert ist.

**Ablauf:**

1. Transaktionsname und Betrag eingeben.
2. Auf **AI suggest** klicken.
3. Die KI analysiert Name und Betrag und schlägt bis zu 3 passende Kategorien aus deiner Kategorienliste vor.
4. Vorschläge werden direkt ins Kategoriefeld übernommen — können vor dem Speichern angepasst werden.

**API-Endpunkt:** `POST /api/ai/suggest-categories`

```json
// Request
{
  "name": "REWE Markt",
  "amount": -42.50
}

// Response
{
  "ok": true,
  "suggestions": ["Lebensmittel", "Einkaufen"]
}
```

### Bulk-Upload (CSV)

Im Bulk-Upload-Bereich (Tabelle nach CSV-Import) erscheint der Button **"AI categorize all"**, wenn KI aktiviert ist. Er kategorisiert alle Transaktionen in der Tabelle sequenziell.

---

## Feature 2: Abonnement-Erkennung

Die Abo-Erkennung läuft **zweistufig** (Hybrid-Algorithmus).

### Stufe 1: Algorithmische Erkennung

Der Algorithmus (`utils/detect-subscriptions.ts`) analysiert alle Transaktionen nach:

- **Namensähnlichkeit** — normalisiert und gruppiert ähnliche Empfängernamen
- **Betragsähnlichkeit** — ±5% Toleranz für gleiche Beträge
- **Zeitliche Periodizität** — erkennt automatisch:

| Periode       | Ungefähres Intervall |
| ------------- | -------------------- |
| Wöchentlich   | ~7 Tage              |
| 14-tägig      | ~14 Tage             |
| Monatlich     | ~30 Tage             |
| Zweimonatlich | ~60 Tage             |
| Quartalsweise | ~90 Tage             |
| Halbjährlich  | ~180 Tage            |
| Jährlich      | ~365 Tage            |

Mindestvoraussetzung: ≥ 2 Vorkommen mit passendem Intervall.

### Stufe 2: KI-Bewertung (optional)

Wenn `AI Subscription Detection` aktiviert ist, sendet die App die algorithmisch gefundenen Kandidaten an die KI. Diese bewertet jeden Kandidaten mit:

- **Confidence Score** (0.0–1.0): Wie wahrscheinlich ist es ein echtes Abonnement?
- **Notes**: Kurze Begründung (z. B. _"Streaming-Dienst"_, _"Versicherungsprämie"_)

Der Score beeinflusst, welche Kandidaten im Modal vorausgewählt sind (≥ 0.7 = vorausgewählt).

### Nutzung

1. Im Bereich **Subscriptions** auf **Detect subscriptions** klicken.
2. Das Modal lädt erkannte Kandidaten mit Konfidenzanzeige.
3. Gewünschte Kandidaten per Checkbox auswählen.
4. **Add selected** klickt — die ausgewählten Einträge werden als Abonnements angelegt.

**API-Endpunkt:** `GET /api/user/subscriptions/detect`

```json
// Response
{
  "ok": true,
  "candidates": [
    {
      "name": "Netflix",
      "amount": -12.99,
      "billingPeriod": "MONTHLY",
      "occurrences": 6,
      "aiConfidence": 0.97,
      "aiNotes": "Streaming-Dienst, sehr wahrscheinlich ein Abonnement"
    }
  ]
}
```

---

## System Prompt

Der optionale System Prompt ermöglicht es, der KI persönlichen Finanzkontext mitzugeben. Er wird **allen KI-Anfragen vorangestellt** — für Kategorisierung und Abo-Erkennung gleichermaßen.

### Beispiel

```
Du bist ein Finanzexperte für private Haushalte im deutschsprachigen Raum.

Kategorisierungsregeln:
- REWE, Edeka, Lidl, Aldi → "Lebensmittel"
- Miete, Nebenkosten, Strom, Heizung → "Wohnen"
- Netflix, Spotify, Disney+, Amazon Prime → "Streaming & Unterhaltung"
- Versicherungen (Haftpflicht, Kfz, Kranken) → "Versicherungen"
- Restaurants, Cafés, Lieferdienste → "Essen gehen"
- Tankstellen, ADAC, Kfz-Werkstatt → "Auto & Transport"

Meine persönliche Situation:
- Ich wohne in Deutschland
- Ich zahle monatlich Miete per Dauerauftrag (kein Kauf)
- Mein Arbeitgeber heißt "Muster GmbH" — Gehaltseingänge als "Gehalt" kategorisieren
```

### Technisches Verhalten

Der System Prompt wird dem **Basis-Prompt** der KI vorangestellt:

```
[Dein System Prompt]

[Technische Anweisung: "You are a personal finance assistant. Given a transaction name..."]
```

Das stellt sicher, dass persönlicher Kontext Priorität hat und die KI trotzdem das erwartete JSON-Ausgabeformat einhält. Maximale Länge: **2000 Zeichen**.

---

## Datenschutz

- Der API-Schlüssel wird **lokal in der SQLite-Datenbank** gespeichert.
- Transaktionsdaten werden **nur an deinen konfigurierten Endpunkt** gesendet — nicht an Dritte.
- Bei Verwendung lokaler Modelle (Ollama, LM Studio) verlassen die Daten deinen Rechner nicht.
- Der MCP-Server überträgt ebenfalls keine Daten — er gibt nur Lesezugriff auf die lokale DB.
