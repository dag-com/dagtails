import { useEffect, useState } from "react";
import type { HubSnapshot } from "./types";

const EMPTY: HubSnapshot = {
  profileVisible: false,
  profileChip: "",
  mocktailMode: false,
  streak: 0,
  levelLabel: "Lv 1",
  rankName: "Trainee",
  stars: 0,
  welcomeMain: "Welcome.",
  welcomeSub: "Your next shift is ready.",
  mascotTier: "",
  cotdName: "—",
  cotdDone: false,
  cotdBtnLabel: "Make it →",
  journeyLabel: "▶ Play the Journey",
  modesUnlocked: false,
  unlockLeft: 5,
  endlessSub: "Survive the rush",
  mixSub: "Invent & share",
  playMeta: "",
  badgesLabel: "🏅 Badges",
  bestLine: "",
  footerHtml: "🍸 cocktails &nbsp;•&nbsp; precision pours &nbsp;•&nbsp; earn your stars",
};

function run(action:
  | "playJourney"
  | "openEndless"
  | "openMixologist"
  | "openCotd"
  | "openTraining"
  | "openHelp"
  | "openBadges"
  | "openSettings"
  | "editProfile",
) {
  window.DagTailsHub?.getActions()?.[action]?.();
}

export function HubScreen() {
  const [snap, setSnap] = useState<HubSnapshot>(EMPTY);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    return window.DagTailsHub?.subscribe((next) => {
      if (next) setSnap(next);
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const wrap = document.getElementById("cta-wrap");
      if (wrap && !wrap.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const duckClass = ["hub-duck", "mascot-duck", snap.mascotTier].filter(Boolean).join(" ");

  return (
    <div className="hub-shell">
      <div className="hero-bg" aria-hidden="true" />
      <div className="start-hub">
        <div className="hub-topbar">
          <div
            className="profile-bar hub-profile"
            id="profile-bar"
            style={{ display: snap.profileVisible ? undefined : "none" }}
          >
            <span className="hub-avatar" aria-hidden="true" />
            <span className="profile-chip" id="profile-chip">
              {snap.profileChip}
            </span>
            <button
              id="btn-edit-profile"
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => run("editProfile")}
            >
              Edit
            </button>
          </div>
          <div className="hub-chips">
            <span className="hub-chip">
              🔥 <span id="hero-streak-value">{snap.streak}</span>
            </span>
            <span className="hub-chip">
              <span id="hero-level-big">{snap.levelLabel}</span>
              {" · "}
              <span id="hero-level-main">{snap.rankName}</span>
            </span>
            <span className="hub-chip">
              ⭐ <span id="hero-stars-total">{snap.stars}</span>
            </span>
            <button
              id="btn-settings"
              className="hub-icon-btn"
              title="Settings"
              type="button"
              onClick={() => run("openSettings")}
            >
              ⚙
            </button>
          </div>
        </div>

        <p
          className="mocktail-banner"
          id="mocktail-banner"
          style={{ display: snap.mocktailMode ? undefined : "none" }}
        >
          🧃 Mocktail mode — alcohol-free menu
        </p>

        <div className="hub-mid">
          <div className="hub-stage">
            <div className={duckClass} id="hub-duck" aria-hidden="true" />
            <p className="hub-status">
              <span className="hub-status-main" id="welcome-back">
                {snap.welcomeMain}
              </span>
              <span className="hub-status-sub" id="welcome-sub">
                {snap.welcomeSub}
              </span>
            </p>
          </div>

          <div className="hub-bottom">
            <div className="hub-quest cotd-card" id="cotd-card">
              <div className="hub-quest-info">
                <span className="hub-quest-eyebrow">🍹 Cocktail of the Day</span>
                <span className="hub-quest-name" id="cotd-name">
                  {snap.cotdName}
                </span>
              </div>
              <button
                id="btn-cotd"
                className={`btn btn-cotd${snap.cotdDone ? " is-done" : ""}`}
                type="button"
                onClick={() => run("openCotd")}
              >
                {snap.cotdBtnLabel}
              </button>
            </div>

            <div className="hub-cta">
              <div className="cta-wrap" id="cta-wrap">
                <div className="cta-split" role="group" aria-label="Play">
                  <button
                    id="btn-start"
                    className="cta-main"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      run("playJourney");
                    }}
                  >
                    {snap.journeyLabel}
                  </button>
                  <button
                    id="btn-cta-caret"
                    className="cta-caret"
                    type="button"
                    aria-label="More game modes"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen((o) => !o);
                    }}
                  >
                    {menuOpen ? "▲" : "▼"}
                  </button>
                </div>
                <div
                  className={`cta-menu${menuOpen ? " is-open" : ""}`}
                  id="cta-menu"
                  role="menu"
                  hidden={!menuOpen}
                >
                  <button
                    id="btn-endless"
                    className={`cta-menu-item${snap.modesUnlocked ? "" : " is-locked"}`}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      run("openEndless");
                    }}
                  >
                    <span className="ico" aria-hidden="true">
                      🔥
                    </span>
                    <span className="cta-menu-text">
                      <strong>Endless</strong>
                      <small id="endless-menu-sub">{snap.endlessSub}</small>
                    </span>
                  </button>
                  <button
                    id="btn-mixologist"
                    className={`cta-menu-item${snap.modesUnlocked ? "" : " is-locked"}`}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      run("openMixologist");
                    }}
                  >
                    <span className="ico" aria-hidden="true">
                      🧪
                    </span>
                    <span className="cta-menu-text">
                      <strong>Mixologist</strong>
                      <small id="mix-menu-sub">{snap.mixSub}</small>
                    </span>
                  </button>
                </div>
              </div>
              <span className="play-meta" id="play-meta">
                {snap.playMeta}
              </span>
            </div>

            <div className="hub-modes hub-modes--quiet">
              <button
                id="btn-training"
                className="hub-link-btn"
                type="button"
                onClick={() => run("openTraining")}
              >
                📚 Learn
              </button>
              <button
                id="btn-how"
                className="hub-link-btn"
                type="button"
                onClick={() => run("openHelp")}
              >
                ❓ Help
              </button>
            </div>
          </div>
        </div>

        <nav className="hub-nav" aria-label="Progress">
          <button
            id="btn-badges"
            className="hub-nav-btn"
            type="button"
            onClick={() => run("openBadges")}
          >
            {snap.badgesLabel}
          </button>
        </nav>

        <p className="best-score" id="start-best">
          {snap.bestLine}
        </p>
      </div>
      <footer
        className="bar-footer"
        id="start-footer"
        dangerouslySetInnerHTML={{ __html: snap.footerHtml }}
      />
    </div>
  );
}
