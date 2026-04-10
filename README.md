# Expense Tracker

Eine selbst gehostete Webanwendung zur Verwaltung von Finanztransaktionen, Ausgaben und Abonnements — mit optionalen KI-Funktionen und MCP-Schnittstelle.

## Überblick

Expense Tracker ist für den **Eigenbetrieb im Heimnetz** (z. B. Unraid, NAS, Raspberry Pi) konzipiert. Es gibt keine Cloud-Abhängigkeit und keine Authentifizierung — die App gehört dir.

## Features

- **Financial Dashboard** — Balkendiagramme und Kreisdiagramm für Einnahmen/Ausgaben-Überblick
- **Transaktionsverwaltung** — Manuelle Eingabe oder CSV-Import (Bulk-Upload mit automatischem Spalten-Mapping)
- **Abonnement-Tracking** — Aktive/inaktive Abos verwalten, monatliche/jährliche Kosten im Überblick
- **KI-gestützte Kategorisierung** — Beim Erfassen einer Transaktion schlägt die KI passende Kategorien vor (Einzeltransaktion + Bulk-CSV)
- **Automatische Abo-Erkennung** — Algorithmische + optionale KI-Analyse erkennt wiederkehrende Transaktionen als Abonnement-Kandidaten
- **MCP HTTP-Server** — Read-only MCP-Schnittstelle für KI-Assistenten (Claude Desktop, Cursor, Windsurf, ...)
- **Responsives Design** — Vollständig nutzbar auf Desktop und Mobilgerät
- **Dark/Light/System-Theme**

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- **Sprache:** [TypeScript](https://www.typescriptlang.org)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **Komponenten:** [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://radix-ui.com)
- **Datenbank:** SQLite via [Prisma ORM](https://prisma.io)
- **Formularvalidierung:** [Zod](https://zod.dev) + [React Hook Form](https://react-hook-form.com)
- **State Management:** [TanStack Query v5](https://tanstack.com/query/latest)
- **Tabellen:** [TanStack Table v8](https://tanstack.com/table/latest)

## Schnellstart

```bash
git clone https://github.com/dein-user/expense-tracker.git
cd expense-tracker
npm install
echo 'DATABASE_URL="file:./prisma/dev.db"' > .env
npx prisma migrate dev
npm run dev
```

App läuft unter [http://localhost:3000](http://localhost:3000).

Weitere Installationsoptionen (Docker, Unraid) → [docs/installation.md](docs/installation.md)

## KI-Funktionen

Die KI-Features sind **vollständig optional** und müssen unter **Settings → AI** aktiviert werden. Jeder OpenAI-kompatible Endpunkt wird unterstützt — also auch lokale Modelle via [Ollama](https://ollama.ai) oder [LM Studio](https://lmstudio.ai).

→ [docs/ai-features.md](docs/ai-features.md)

## MCP-Integration

Der MCP HTTP-Server unter `/api/mcp` ermöglicht KI-Assistenten direkten Lesezugriff auf Finanzdaten.

Konfigurationsbeispiel für **Claude Desktop**:

```json
{
  "mcpServers": {
    "expense-tracker": {
      "url": "http://localhost:3000/api/mcp",
      "transport": { "type": "http" }
    }
  }
}
```

Vollständige Integrationsanleitung (Cursor, Windsurf, VS Code, Continue.dev) → [docs/mcp.md](docs/mcp.md)

## Dokumentation

| Dokument                                     | Inhalt                                                   |
| -------------------------------------------- | -------------------------------------------------------- |
| [docs/installation.md](docs/installation.md) | Lokale Einrichtung, Docker, Unraid-Setup                 |
| [docs/ai-features.md](docs/ai-features.md)   | KI-Konfiguration, Kategorisierung, Abo-Erkennung         |
| [docs/mcp.md](docs/mcp.md)                   | MCP-Server, Tool-Referenz, Integration in KI-Tools       |
| [docs/architecture.md](docs/architecture.md) | Tech Stack, Verzeichnisstruktur, API-Routen, Datenmodell |

## Umgebungsvariablen

Einzige erforderliche Variable:

```env
DATABASE_URL="file:./prisma/dev.db"
```

## Lizenz

MIT
