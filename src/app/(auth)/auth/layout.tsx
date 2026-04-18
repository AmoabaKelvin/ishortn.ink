import type { ReactNode } from "react";

import { Wordmark } from "../../(landing)/_components/warm-primitives";

const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div
      data-theme="warm"
      data-accent="terracotta"
      style={{
        minHeight: "100vh",
        background: "var(--warm-bg)",
        color: "var(--warm-ink)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      <header style={{ padding: "32px 48px" }}>
        <a href="/" aria-label="iShortn home">
          <Wordmark />
        </a>
      </header>

      <main
        style={{
          display: "grid",
          placeItems: "center",
          padding: "24px 24px 48px",
        }}
      >
        {children}
      </main>

      <footer
        style={{
          padding: "24px 48px",
          fontSize: 12,
          color: "var(--warm-mute)",
          textAlign: "center",
        }}
      >
        A quietly lovely URL shortener. © {new Date().getFullYear()} iShortn.
      </footer>
    </div>
  );
};

export default AuthLayout;
