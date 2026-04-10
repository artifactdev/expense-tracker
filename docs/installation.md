# Installation

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 18
- npm ≥ 9
- Git

---

## Lokale Entwicklung

### 1. Repository klonen

```bash
git clone https://github.com/dein-user/expense-tracker.git
cd expense-tracker
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Umgebungsvariablen anlegen

```bash
cp .env.example .env
```

Einzige **zwingend erforderliche** Variable:

```env
DATABASE_URL="file:./prisma/dev.db"
```

Die App ist eine Single-User-Applikation ohne Authentifizierung. Alle anderen Variablen in `.env.example` stammen aus dem ursprünglichen Multi-User-Fork und werden nicht mehr benötigt.

### 4. Datenbank initialisieren

```bash
# Alle Migrationen anwenden und Prisma Client generieren
npx prisma migrate dev

# Optional: Seed-Daten einspielen (Demo-Transaktionen & Kategorien)
npm run db:seed
```

### 5. Entwicklungsserver starten

```bash
npm run dev
```

Die App ist jetzt unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## Docker

### Dockerfile-Überblick

Das mitgelieferte `Dockerfile` nutzt ein **Multi-Stage-Build**:

1. **Build-Stage** (`node:18-alpine`): Installiert alle Dependencies, baut die Next.js-App via Turbopack und entfernt dann Dev-Dependencies.
2. **Runtime-Stage** (`node:18-alpine`): Schlankes Produktionsimage mit dem fertigen Build.

### Image lokal bauen und starten

```bash
docker build -t expense-tracker .

docker run -d \
  --name expense-tracker \
  -p 3000:3000 \
  -v /dein/datenpfad:/app/prisma \
  -e DATABASE_URL="file:/app/prisma/dev.db" \
  expense-tracker
```

> **Wichtig:** Das Volume (`-v`) muss auf ein Verzeichnis auf dem Host zeigen, das die Datei `dev.db` enthält oder enthhalten wird. Nur so bleibt die SQLite-Datenbank zwischen Container-Neustarts erhalten.

---

## Unraid — Docker via Community Applications / UI

Diese Anleitung beschreibt, wie die App auf einem **Unraid-Server** als Docker-Container betrieben wird und die Datenbank **persistent** bleibt.

### Schritt 1: Image verfügbar machen

Entweder:

- **Option A** – auf Docker Hub pushen und den Image-Namen notieren (`deinuser/expense-tracker:latest`)
- **Option B** – Image lokal auf dem Unraid-Server bauen (Terminal → `docker build`)

Für diese Anleitung wird Option A empfohlen.

### Schritt 2: Container in der Unraid-UI anlegen

1. Im Unraid-Webinterface auf **Docker** → **Add Container** klicken.
2. Folgende Felder ausfüllen:

| Feld             | Wert                                   |
| ---------------- | -------------------------------------- |
| **Name**         | `expense-tracker`                      |
| **Repository**   | `deinuser/expense-tracker:latest`      |
| **Network Type** | `bridge`                               |
| **Port Mapping** | Host: `3000` → Container: `3000` (TCP) |

### Schritt 3: Datenbank-Volume anlegen (persistent Storage)

Dies ist der **kritische Schritt** für persistente Daten.

1. Klicke auf **Add another Path, Port, Variable, Label or Device**.
2. Wähle **Path**.
3. Fülle die Felder aus:

| Feld               | Wert                                       |
| ------------------ | ------------------------------------------ |
| **Config Type**    | `Path`                                     |
| **Name**           | `Database`                                 |
| **Container Path** | `/app/prisma`                              |
| **Host Path**      | `/mnt/user/appdata/expense-tracker/prisma` |
| **Access Mode**    | `Read/Write`                               |

> Unraid legt das Verzeichnis `/mnt/user/appdata/expense-tracker/prisma` automatisch an, wenn es noch nicht existiert.

### Schritt 4: Umgebungsvariable DATABASE_URL setzen

1. Klicke erneut auf **Add another Path, Port, Variable...**.
2. Wähle **Variable**.

| Feld            | Wert                      |
| --------------- | ------------------------- |
| **Config Type** | `Variable`                |
| **Name**        | `DATABASE_URL`            |
| **Key**         | `DATABASE_URL`            |
| **Value**       | `file:/app/prisma/dev.db` |

### Schritt 5: Datenbank initialisieren (erster Start)

Beim allerersten Start existiert noch keine `dev.db`. Die Migrationen müssen manuell einmalig ausgeführt werden:

1. Container starten.
2. Im Unraid-Webinterface auf **Docker** → das drei-Punkte-Menü des Containers → **Console** klicken.
3. Im Terminal des Containers ausführen:

```bash
npx prisma migrate deploy
```

> `migrate deploy` (nicht `dev`) wendet alle vorhandenen Migrationen an, ohne interaktiv zu fragen — ideal für Produktionsumgebungen.

Ab sofort überlebt die Datenbank jeden Container-Neustart und jedes Image-Update, solange das Host-Verzeichnis unberührt bleibt.

### Schritt 6: Container speichern und starten

Auf **Apply** klicken. Unraid startet den Container. Die App ist unter `http://unraid-ip:3000` erreichbar.

### Tipps für Unraid

- **Backup:** Das gesamte Daten-Verzeichnis `/mnt/user/appdata/expense-tracker/prisma` mit dem Unraid-Backup-Plugin (z. B. CA Backup/Restore) sichern.
- **Reverse Proxy:** Mit dem **Nginx Proxy Manager** (ebenfalls als Container verfügbar) kann die App unter einer eigenen Domain mit SSL betrieben werden.
- **Auto-Update:** Das Plugin **CA Auto-Update Applications** aktualisiert das Image automatisch, sobald eine neue Version auf Docker Hub verfügbar ist.

---

## Umgebungsvariablen — Referenz

| Variable       | Pflicht | Beschreibung                   | Beispiel                  |
| -------------- | ------- | ------------------------------ | ------------------------- |
| `DATABASE_URL` | ✅      | Pfad zur SQLite-Datenbankdatei | `file:/app/prisma/dev.db` |

Alle anderen Variablen aus `.env.example` sind Legacy-Überbleibsel aus dem ursprünglichen Multi-User-Fork und haben aktuell keinen Effekt.
