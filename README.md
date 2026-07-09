# Grenzmark

Grundlage für ein beständiges Browser-Strategiespiel. Der erste Meilenstein enthält eine responsive Startseite sowie Registrierung, Login und Logout.

## Lokal starten

Voraussetzung: Node.js 24 oder neuer.

```bash
npm install
npm run dev
```

Danach ist die Anwendung unter `http://localhost:3000` erreichbar. Die lokale SQLite-Datenbank wird automatisch als `data/grenzmark.db` angelegt und nicht in Git aufgenommen.

## Prüfungen

```bash
npm run lint
npm run build
```

## Aktueller Aufbau

- Next.js 16, React 19 und TypeScript
- serverseitige Form Actions
- Passwörter mit `scrypt` und individuellem Salt gehasht
- zufällige, nur als Hash gespeicherte Sitzungs-Tokens
- HTTP-only Session-Cookie mit SameSite-Schutz
- SQLite für die lokale Entwicklungsphase

Vor dem öffentlichen Betrieb wird die Datenhaltung auf PostgreSQL umgestellt und Rate-Limiting für die Authentifizierung ergänzt.
