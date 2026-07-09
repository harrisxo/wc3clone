import { chooseRace } from "@/lib/actions/race";
import type { Race } from "@/lib/auth";
import { raceData } from "./shared";

export function RaceSelection({ username }: { username: string }) {
  return <main className="race-selection">
    <div className="selection-glow" />
    <header className="selection-header">
      <span className="brand-mark">G</span>
      <span>Grenzmark</span>
    </header>
    <section className="selection-content">
      <p className="eyebrow">Willkommen, {username}</p>
      <h1>Wähle dein Volk</h1>
      <p className="selection-intro">Diese Entscheidung prägt dein Reich und kann später nicht geändert werden. Wähle mit Bedacht.</p>
      <div className="race-grid">
        {(Object.entries(raceData) as [Race, (typeof raceData)[Race]][]).map(([key, race]) =>
          <form action={chooseRace} className={`race-card race-${key}`} key={key}>
            <input type="hidden" name="race" value={key} />
            <div className="race-sigil" aria-hidden="true">{race.sigil}</div>
            <span className="race-kicker">{race.title}</span>
            <h2>{race.name}</h2>
            <p>{race.description}</p>
            <button type="submit">{race.name} wählen</button>
          </form>
        )}
      </div>
      <p className="permanent-warning">Die Auswahl wird dauerhaft mit deinem Konto verbunden.</p>
    </section>
  </main>;
}
