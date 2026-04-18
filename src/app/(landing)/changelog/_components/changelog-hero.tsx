export function ChangelogHero() {
  return (
    <header className="cl-head">
      <div className="warm-container">
        <div className="warm-eyebrow" style={{ marginBottom: 24 }}>
          <span className="warm-eyebrow-dot" />
          Changelog
        </div>
        <h1
          className="warm-display"
          style={{
            margin: 0,
            maxWidth: 900,
            fontSize: "clamp(54px, 9vw, 84px)",
          }}
        >
          What we've{" "}
          <span
            style={{ fontStyle: "italic", color: "var(--warm-accent)" }}
          >
            shipped
          </span>{" "}
          — big and small.
        </h1>
        <p
          style={{
            fontSize: 19,
            color: "var(--warm-ink-soft)",
            maxWidth: 620,
            marginTop: 24,
            lineHeight: 1.5,
          }}
        >
          A public log of every release. We ship weekly-ish, and we try to
          write these like letters — not press notes.
        </p>
      </div>
    </header>
  );
}
