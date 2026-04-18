import Image from "next/image";

import { Icon } from "./warm-primitives";

export const DashboardPreview = () => {
  return (
    <section
      id="features"
      className="warm-section warm-section-paper"
      style={{ background: "var(--warm-paper)" }}
    >
      <div className="warm-container">
        <div
          style={{
            textAlign: "center",
            maxWidth: 720,
            margin: "0 auto 72px",
          }}
        >
          <div
            className="warm-eyebrow"
            style={{ marginBottom: 24, justifyContent: "center" }}
          >
            <Icon.Chart
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            See what's working
          </div>
          <h2
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(44px, 7vw, 80px)" }}
          >
            Know who clicked,
            <br />
            <em style={{ color: "var(--warm-accent)", fontStyle: "italic" }}>
              where from, when.
            </em>
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--warm-mute)",
              marginTop: 24,
              lineHeight: 1.6,
            }}
          >
            Every short link comes with its own dashboard. No extra setup, no
            cookie banners to install, no reports to schedule.
          </p>
        </div>

        <div
          className="warm-card"
          style={{
            overflow: "hidden",
            boxShadow: "0 40px 80px -40px rgba(43,31,23,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 20px",
              borderBottom: "1px solid var(--warm-line-soft)",
              gap: 14,
              background: "var(--warm-paper-2)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: "var(--warm-line)",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                padding: "6px 14px",
                background: "var(--warm-paper)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--warm-mute)",
                border: "1px solid var(--warm-line-soft)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon.Link style={{ width: 11, height: 11 }} />
              ishortn.ink / dashboard
            </div>
            <div style={{ flex: 1 }} />
          </div>

          <Image
            src="/landing/dashboard-warm.png"
            alt="iShortn dashboard — warm recolor"
            width={2400}
            height={1400}
            sizes="(min-width: 1280px) 1184px, 100vw"
            priority={false}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 13,
            color: "var(--warm-mute)",
            fontStyle: "italic",
            fontFamily: "var(--font-warm-display)",
          }}
        >
          Your actual dashboard — wearing its new coat of paint.
        </div>
      </div>
    </section>
  );
};
