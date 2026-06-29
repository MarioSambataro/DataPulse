import { Scene } from "./three/Scene";
import { useStore } from "./store/useStore";

/** HUD tattico minimale. Pannelli dati (ticker/stat/filtri) → SEZIONE 8. */
function Hud() {
  const autoRotate = useStore((s) => s.autoRotate);
  const toggleAutoRotate = useStore((s) => s.toggleAutoRotate);
  const globeView = useStore((s) => s.globeView);
  const toggleGlobeView = useStore((s) => s.toggleGlobeView);

  return (
    <div className="hud" aria-hidden="false">
      {/* Cornici angolari stile command-center */}
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />

      <header className="hud-top">
        <div className="brand">
          <span className="brand-mark">◊</span>
          <span className="brand-name">DATAPULSE</span>
          <span className="brand-sub">GEO-TECTONIC COMMAND CENTER</span>
        </div>
        <div className="hud-status">
          <span className="dot" /> SYS ONLINE
        </div>
      </header>

      <footer className="hud-bottom">
        <div className="hint">DRAG · ROTATE &nbsp;|&nbsp; SCROLL · ZOOM</div>
        <div className="controls">
          <button
            type="button"
            className={`toggle ${globeView === "day" ? "on" : ""}`}
            onClick={toggleGlobeView}
          >
            VIEW · {globeView === "day" ? "DAY" : "NIGHT"}
          </button>
          <button
            type="button"
            className={`toggle ${autoRotate ? "on" : ""}`}
            onClick={toggleAutoRotate}
          >
            AUTO-ROTATE {autoRotate ? "ON" : "OFF"}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <Scene />
      <Hud />
    </div>
  );
}
