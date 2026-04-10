# Architektur

## Überblick

Expense Tracker ist eine **Single-User-Webanwendung** auf Basis von Next.js mit lokaler SQLite-Datenbank. Es gibt keine Authentifizierung — die App ist für den Eigenbetrieb im Heimnetz oder auf einem privaten Server (z. B. Unraid) ausgelegt.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  Next.js App Router (React, Tailwind, shadcn/ui)            │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────────┐
│                    Next.js Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  API Routes   │  │  AI Service  │  │    MCP Handler     │ │
│  │ /api/**      │  │ services/ai  │  │  /api/mcp (HTTP)   │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘ │
│         │                 │                    │             │
│  ┌──────▼─────────────────▼────────────────────▼──────────┐  │
│  │                    Prisma ORM                           │  │
│  └────────────────────────┬────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  SQLite (dev.db) │
                   └─────────────────┘
```

---

## Tech Stack

| Schicht             | Technologie                     | Version |
| ------------------- | ------------------------------- | ------- |
| Framework           | Next.js (App Router, Turbopack) | ^16     |
| Sprache             | TypeScript                      | ^5      |
| Styling             | Tailwind CSS                    | ^3      |
| Komponenten         | shadcn/ui + Radix UI            | —       |
| Datenbankzugriff    | Prisma ORM                      | ^6      |
| Datenbank           | SQLite                          | —       |
| Formularvalidierung | React Hook Form + Zod           | —       |
| State Management    | TanStack Query v5               | —       |
| Tabellen            | TanStack Table v8               | —       |
| Animationen         | GSAP + Framer Motion            | —       |
| Linting             | ESLint + Prettier               | —       |

---

## Verzeichnisstruktur

```
expense-tracker/
├── app/                        # Next.js App Router
│   ├── (dashboard)/            # Dashboard-Layout-Gruppe
│   │   └── dashboard/          # Alle Dashboard-Seiten
│   │       ├── page.tsx        # Übersicht
│   │       ├── transactions/   # Transaktionen
│   │       ├── subscriptions/  # Abonnements
│   │       └── settings/
│   │           ├── profile/    # Profil-Einstellungen
│   │           └── ai/         # KI-Einstellungen (neu)
│   ├── (home)/                 # Öffentliche Landing Page
│   ├── api/                    # API-Routen (Next.js Route Handlers)
│   │   ├── ai/
│   │   │   └── suggest-categories/   # KI-Kategorisierung (neu)
│   │   ├── categories/
│   │   ├── mcp/                      # MCP HTTP-Server (neu)
│   │   ├── transactions/
│   │   │   ├── add/bulk/
│   │   │   ├── add/single/
│   │   │   ├── delete/
│   │   │   ├── filtered/
│   │   │   ├── get-csv-headers/
│   │   │   ├── update/
│   │   │   └── upload/
│   │   └── user/
│   │       ├── ai-settings/          # KI-Einstellungen API (neu)
│   │       ├── categories/
│   │       ├── change-name/
│   │       ├── change-preferences/
│   │       ├── preferences/
│   │       ├── subscriptions/
│   │       │   ├── add/
│   │       │   ├── delete/
│   │       │   ├── detect/           # Abo-Erkennung API (neu)
│   │       │   └── update/
│   │       └── update-trans-dates/
│   └── globals.css
│
├── components/                 # React-Komponenten
│   ├── forms/
│   │   ├── ai-settings-form/   # KI-Einstellungen-Formular (neu)
│   │   ├── transactions/       # Transaktionsformular (KI-Button neu)
│   │   └── ...
│   ├── modal/
│   │   └── subscriptions/
│   │       └── detect-subscriptions-modal.tsx  # (neu)
│   ├── tables/
│   │   └── add-transactions-tables/  # Bulk-Upload (KI-Button neu)
│   └── subscriptions/
│       └── subscription-content.tsx  # (Detect-Button neu)
│
├── services/
│   └── ai.ts                   # KI-Service-Schicht (neu)
│
├── utils/
│   └── detect-subscriptions.ts # Algorithmus (neu)
│
├── schemas/                    # Zod-Schemata
├── prisma/
│   ├── schema.prisma
│   ├── dev.db                  # SQLite-Datenbankdatei
│   └── migrations/
├── docs/                       # Diese Dokumentation (neu)
└── Dockerfile
```

---

## Datenmodell

### User

```prisma
model User {
  id                      String   @id
  name                    String
  email                   String   @unique
  currency                String   @default("EUR")
  dateFormat              String   @default("EU")
  theme                   String   @default("system")
  transactionsDateFrom    String?
  transactionsDateTo      String?
  // KI-Felder (neu hinzugefügt)
  aiEnabled               Boolean  @default(false)
  aiCategoriesEnabled     Boolean  @default(false)
  aiSubscriptionDetection Boolean  @default(false)
  aiEndpoint              String?
  aiModel                 String?
  aiApiKey                String?
  aiSystemPrompt          String?
  // Relationen
  categories              UserCategory[]
  transactions            Transaction[]
  subscriptions           Subscription[]
}
```

Der User mit der fixen ID `local_user_default` ist die einzige Instanz. Die App ist bewusst single-user — die `userId`-Felder in Transaction/Subscription dienen der referenziellen Integrität, nicht echter Mandantenfähigkeit.

### Transaction

```
Transaction → TransactionCategory ← Category ← UserCategory ← User
```

Kategorien sind M:N über `TransactionCategory`. Kategorien können gemeinsam (`common: true`) oder benutzerspezifisch sein.

### Subscription

Direkt am User. `billingPeriod`-Werte: `MONTHLY | BI-MONTHLY | QUARTERLY | SEMI-ANNUALLY | ANNUALLY | BIENNIALLY`.

---

## API-Routen Referenz

### Transaktionen

| Method | Pfad                                | Beschreibung                                 |
| ------ | ----------------------------------- | -------------------------------------------- |
| POST   | `/api/transactions/filtered`        | Gefilterte Transaktionen abrufen             |
| POST   | `/api/transactions/add/single`      | Einzelne Transaktion anlegen                 |
| POST   | `/api/transactions/add/bulk`        | Mehrere Transaktionen anlegen                |
| POST   | `/api/transactions/upload`          | CSV-Datei hochladen und parsen               |
| GET    | `/api/transactions/get-csv-headers` | CSV-Spaltenköpfe auslesen                    |
| POST   | `/api/transactions/update`          | Kategorie(n) einer Transaktion aktualisieren |
| DELETE | `/api/transactions/delete`          | Transaktionen löschen                        |

### Benutzer & Einstellungen

| Method   | Pfad                           | Beschreibung                               |
| -------- | ------------------------------ | ------------------------------------------ |
| GET/POST | `/api/user/ai-settings`        | KI-Einstellungen lesen/schreiben           |
| GET/POST | `/api/user/categories`         | Eigene Kategorien                          |
| POST     | `/api/user/change-name`        | Name ändern                                |
| POST     | `/api/user/change-preferences` | Präferenzen (Währung, Datumsformat, Theme) |
| GET      | `/api/user/preferences`        | Präferenzen lesen                          |
| POST     | `/api/user/update-trans-dates` | Transaktionsdatumsbereich setzen           |

### Abonnements

| Method | Pfad                             | Beschreibung                          |
| ------ | -------------------------------- | ------------------------------------- |
| GET    | `/api/user/subscriptions`        | Alle Abonnements                      |
| POST   | `/api/user/subscriptions/add`    | Abonnement anlegen                    |
| POST   | `/api/user/subscriptions/update` | Abonnement aktualisieren              |
| DELETE | `/api/user/subscriptions/delete` | Abonnement löschen                    |
| GET    | `/api/user/subscriptions/detect` | Abonnements algorithmisch/KI erkennen |

### KI & MCP

| Method | Pfad                         | Beschreibung                             |
| ------ | ---------------------------- | ---------------------------------------- |
| POST   | `/api/ai/suggest-categories` | Kategorievorschläge für eine Transaktion |
| GET    | `/api/mcp`                   | MCP Server-Info und Tool-Liste           |
| POST   | `/api/mcp`                   | MCP JSON-RPC 2.0 Handler                 |

---

## Datenfluss — KI-Kategorisierung

```
Browser
  └─ KI-Button Click
       └─ POST /api/ai/suggest-categories { name, amount }
            └─ services/ai.ts → getAISettings() → Prisma
            └─ services/ai.ts → suggestCategories()
                 └─ GET Kategorien → Prisma
                 └─ POST {endpoint}/chat/completions (OpenAI-API)
                 └─ JSON-Parsing der Antwort
            └─ Response: { ok, suggestions: string[] }
  └─ Vorschläge ins Formular übernehmen
```

## Datenfluss — Abo-Erkennung

```
Browser
  └─ "Detect subscriptions" Click
       └─ GET /api/user/subscriptions/detect
            └─ Alle Transaktionen lesen → Prisma
            └─ detectSubscriptions() [utils/detect-subscriptions.ts]
                 └─ Name-Normalisierung + Betrags-Clustering + Periodenanalyse
                 └─ Kandidaten-Liste
            └─ (wenn AI aktiviert) enrichSubscriptionCandidates()
                 └─ POST {endpoint}/chat/completions
                 └─ Confidence-Scores mergen
            └─ Response: { ok, candidates[] }
  └─ Modal mit Checkboxen → Auswahl → POST /api/user/subscriptions/add
```
