import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  if (await getCurrentUser()) redirect("/game");
  return (
    <main className="site-shell">
      <div className="ambient ambient-left" /><div className="ambient ambient-right" />
      <nav className="topbar" aria-label="Hauptnavigation">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">G</span><span>Grenzmark</span></Link>
        <span className="phase-badge">Frühe Entwicklung</span>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Ein Reich entsteht nicht an einem Tag</p>
          <h1>Erobere Land.<br /><span>Schreibe Geschichte.</span></h1>
          <p className="lead">Plane deine Feldzüge, sichere neue Gebiete und miss dich mit anderen Herrschern in einer beständigen, lebendigen Welt.</p>
          <div className="feature-row" aria-label="Spielmerkmale">
            <div><strong>Strategisch</strong><span>Jede Entscheidung zählt</span></div>
            <div><strong>Beständig</strong><span>Die Welt schläft nie</span></div>
            <div><strong>Gemeinsam</strong><span>Verbünde dich oder kämpfe</span></div>
          </div>
        </div>
        <aside className="auth-card" aria-label="Spielerkonto"><AuthPanel /></aside>
      </section>
      <footer><span>© {new Date().getFullYear()} Grenzmark</span><span>Eine Welt im Aufbau</span></footer>
    </main>
  );
}
