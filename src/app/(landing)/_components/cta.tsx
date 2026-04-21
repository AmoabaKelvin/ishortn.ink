import { Link } from "next-view-transitions";

import { Paths } from "@/lib/constants/app";

import { Icon } from "./warm-primitives";

export const CTA = () => {
  return (
    <section
      className="warm-section warm-cta"
      style={{
        background: "var(--warm-ink)",
        color: "var(--warm-paper)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-warm-display)",
          fontSize: "clamp(180px, 40vw, 520px)",
          lineHeight: 1,
          color: "rgba(255,255,255,0.04)",
          fontStyle: "italic",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        shortn
      </div>
      <div
        className="warm-container"
        style={{ position: "relative", textAlign: "center" }}
      >
        <div
          className="warm-eyebrow"
          style={{
            marginBottom: 28,
            justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--warm-paper)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--warm-accent)",
            }}
          />
          90 seconds to your first link
        </div>
        <h2
          className="warm-display"
          style={{ margin: 0, fontSize: "clamp(52px, 14vw, 140px)", overflowWrap: "break-word" }}
        >
          Your links
          <br />
          deserve{" "}
          <em
            style={{
              color: "var(--warm-accent)",
              fontStyle: "italic",
            }}
          >
            better.
          </em>
        </h2>
        <p
          style={{
            fontSize: 19,
            color: "rgba(252,245,238,0.7)",
            marginTop: 32,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.5,
          }}
        >
          Free to start. No credit card. Upgrade when you're ready.
        </p>
        <div
          style={{
            marginTop: 44,
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={Paths.Signup}
            className="warm-btn warm-btn-accent warm-btn-lg"
            style={{ padding: "20px 32px", fontSize: 16 }}
          >
            Start for free <Icon.Arrow />
          </Link>
          <Link
            href="/#features"
            className="warm-btn warm-btn-lg"
            style={{
              padding: "20px 32px",
              fontSize: 16,
              border: "1px solid rgba(255,255,255,0.2)",
              color: "var(--warm-paper)",
            }}
          >
            See a quick demo
          </Link>
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 32,
            justifyContent: "center",
            flexWrap: "wrap",
            color: "rgba(252,245,238,0.55)",
            fontSize: 13,
          }}
        >
          <span
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              whiteSpace: "nowrap",
            }}
          >
            <Icon.Check style={{ color: "var(--warm-accent)" }} /> Free forever plan
          </span>
          <span
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              whiteSpace: "nowrap",
            }}
          >
            <Icon.Check style={{ color: "var(--warm-accent)" }} /> No card required
          </span>
          <span
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              whiteSpace: "nowrap",
            }}
          >
            <Icon.Check style={{ color: "var(--warm-accent)" }} /> Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
};
