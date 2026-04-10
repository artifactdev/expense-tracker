# MCP — Model Context Protocol

Der Expense Tracker stellt einen **read-only MCP-Server** unter `/api/mcp` bereit. Damit können KI-Assistenten (Claude, Cursor, Windsurf, etc.) direkt auf deine Finanzdaten zugreifen und Fragen wie _"Was habe ich letzten Monat für Lebensmittel ausgegeben?"_ oder _"Welche Abonnements kosten mich am meisten?"_ beantworten.

## Transportprotokoll

Der Server verwendet **MCP über HTTP** (Streamable HTTP, MCP Spec 2025-03-26). Alle Anfragen sind einfache HTTP POST-Requests mit JSON-RPC 2.0-Payloads.

- **Endpunkt:** `POST http://<host>:3000/api/mcp`
- **Info-Endpunkt:** `GET http://<host>:3000/api/mcp` (gibt verfügbare Tools und Konfigurationsbeispiel zurück)
- **Zugriff:** Read-only — keine Schreiboperationen möglich

---

## Verfügbare Tools

| Tool                     | Beschreibung                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `list_transactions`      | Transaktionen abrufen mit optionalen Filtern                   |
| `get_transaction_by_id`  | Einzelne Transaktion per ID abrufen                            |
| `list_categories`        | Alle verfügbaren Kategorien auflisten                          |
| `list_subscriptions`     | Alle Abonnements auflisten                                     |
| `get_spending_summary`   | Einnahmen/Ausgaben-Zusammenfassung (nach Monat oder Kategorie) |
| `get_subscription_costs` | Hochgerechnete Abo-Kosten (monatlich und jährlich)             |

### Tool-Parameter im Detail

#### `list_transactions`

| Parameter   | Typ                     | Beschreibung                                  |
| ----------- | ----------------------- | --------------------------------------------- |
| `startDate` | `string`                | Startdatum `yyyy-MM-dd` (optional)            |
| `endDate`   | `string`                | Enddatum `yyyy-MM-dd` (optional)              |
| `category`  | `string`                | Kategoriefilter (Teilstring, optional)        |
| `type`      | `"income" \| "expense"` | Nur Einnahmen oder Ausgaben (optional)        |
| `limit`     | `number`                | Maximale Ergebnisanzahl, Standard 50, max 500 |
| `offset`    | `number`                | Pagination-Offset                             |

#### `get_spending_summary`

| Parameter   | Typ                               | Beschreibung                          |
| ----------- | --------------------------------- | ------------------------------------- |
| `startDate` | `string`                          | Startdatum `yyyy-MM-dd` (**Pflicht**) |
| `endDate`   | `string`                          | Enddatum `yyyy-MM-dd` (**Pflicht**)   |
| `groupBy`   | `"month" \| "category" \| "none"` | Gruppierung (Standard: `none`)        |

---

## Integration in KI-Tools

### Claude Desktop

Konfigurationsdatei: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) bzw. `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

```json
{
  "mcpServers": {
    "expense-tracker": {
      "url": "http://localhost:3000/api/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

Nach dem Speichern Claude Desktop neu starten. Im Chat erscheint dann das Werkzeug-Symbol mit den verfügbaren Tools.

**Für Unraid/Remote-Server** die URL entsprechend anpassen:

```json
"url": "http://192.168.1.100:3000/api/mcp"
```

---

### Cursor

In Cursor unter **Settings → MCP → Add Server** oder direkt in `.cursor/mcp.json` im Projekt- oder Home-Verzeichnis:

```json
{
  "mcpServers": {
    "expense-tracker": {
      "url": "http://localhost:3000/api/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

Alternativ über die Cursor-UI:

1. `Cmd+Shift+P` → **MCP: Add Server**
2. Transport: **HTTP**
3. URL: `http://localhost:3000/api/mcp`
4. Name: `expense-tracker`

---

### Windsurf (Codeium)

Konfigurationsdatei: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "expense-tracker": {
      "serverUrl": "http://localhost:3000/api/mcp"
    }
  }
}
```

Windsurf neu starten und in den Cascade-Einstellungen prüfen, dass der Server als verbunden angezeigt wird.

---

### VS Code (GitHub Copilot / MCP Extension)

In `.vscode/mcp.json` im Workspace oder in den User-Settings:

```json
{
  "servers": {
    "expense-tracker": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

---

### Continue.dev

In `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "http",
          "url": "http://localhost:3000/api/mcp"
        }
      }
    ]
  }
}
```

---

### Allgemeines MCP-HTTP-Client-Beispiel (curl)

```bash
# Server-Info abrufen
curl http://localhost:3000/api/mcp

# Tool-Liste abfragen
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Transaktionen der letzten 30 Tage abrufen
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_transactions",
      "arguments": {
        "startDate": "2026-03-01",
        "endDate": "2026-03-31",
        "type": "expense",
        "limit": 50
      }
    }
  }'

# Ausgabenübersicht nach Kategorie
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_spending_summary",
      "arguments": {
        "startDate": "2026-01-01",
        "endDate": "2026-03-31",
        "groupBy": "category"
      }
    }
  }'
```

---

## Sicherheitshinweise

- Der MCP-Endpunkt ist **ohne Authentifizierung** erreichbar. Er sollte **nicht** direkt über das Internet exponiert werden.
- Im Heimnetz oder hinter einem Reverse Proxy mit Basic Auth / IP-Whitelist betreiben.
- Alle Tools sind **read-only** — Schreiboperationen sind über MCP nicht möglich.
- Für Zugriff von außen empfiehlt sich ein VPN (z. B. Tailscale oder WireGuard auf Unraid).

---

## MCP-Protokoll-Details

Der Server implementiert die **MCP Spec 2025-03-26** manuell ohne SDK:

| Method                      | Beschreibung                                                          |
| --------------------------- | --------------------------------------------------------------------- |
| `initialize`                | Protokoll-Handshake, gibt `protocolVersion` und `capabilities` zurück |
| `notifications/initialized` | Bestätigung vom Client nach `initialize`                              |
| `ping`                      | Health-Check                                                          |
| `tools/list`                | Liste aller verfügbaren Tools                                         |
| `tools/call`                | Tool ausführen mit `name` und `arguments`                             |

Antwortformat bei `tools/call`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{ \"id\": \"...\", \"name\": \"...\", ... }]"
      }
    ]
  }
}
```
