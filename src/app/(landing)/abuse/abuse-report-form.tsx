"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ABUSE_CATEGORY_LABELS, abuseCategoryValues } from "@/server/api/routers/abuse/abuse.input";
import { api } from "@/trpc/react";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "var(--warm-radius-sm)",
  border: "1px solid var(--warm-line)",
  background: "var(--warm-paper)",
  color: "var(--warm-ink)",
  fontSize: 14,
  fontFamily: "var(--font-warm-ui)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--warm-ink-soft)",
};

export function AbuseReportForm() {
  const [shortUrl, setShortUrl] = useState("");
  const [category, setCategory] = useState<(typeof abuseCategoryValues)[number]>("phishing");
  const [reporterEmail, setReporterEmail] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reportMutation = api.abuse.report.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reportMutation.mutate({
      shortUrl: shortUrl.trim(),
      category,
      reporterEmail: reporterEmail.trim() || undefined,
      details: details.trim() || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="warm-card" style={{ padding: 32, textAlign: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Report received</h2>
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "var(--warm-mute)",
            lineHeight: 1.6,
          }}
        >
          Thank you. Our team reviews every report and takes action on links that violate our
          policies. If you left an email, we may reach out for more detail.
        </p>
        <button
          type="button"
          className="warm-btn warm-btn-ghost"
          style={{ marginTop: 24 }}
          onClick={() => {
            setShortUrl("");
            setCategory("phishing");
            setReporterEmail("");
            setDetails("");
            setSubmitted(false);
          }}
        >
          Report another link
        </button>
      </div>
    );
  }

  return (
    <form
      className="warm-card"
      style={{ padding: 32, display: "grid", gap: 20 }}
      onSubmit={handleSubmit}
    >
      <div>
        <label htmlFor="shortUrl" style={labelStyle}>
          Short link <span style={{ color: "var(--warm-accent)" }}>*</span>
        </label>
        <input
          id="shortUrl"
          type="text"
          required
          placeholder="ishortn.ink/abc"
          value={shortUrl}
          onChange={(e) => setShortUrl(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div>
        <label htmlFor="category" style={labelStyle}>
          Reason <span style={{ color: "var(--warm-accent)" }}>*</span>
        </label>
        <select
          id="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof abuseCategoryValues)[number])}
          style={fieldStyle}
        >
          {abuseCategoryValues.map((value) => (
            <option key={value} value={value}>
              {ABUSE_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="reporterEmail" style={labelStyle}>
          Your email <span style={{ color: "var(--warm-mute)", fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="reporterEmail"
          type="email"
          placeholder="you@example.com"
          value={reporterEmail}
          onChange={(e) => setReporterEmail(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div>
        <label htmlFor="details" style={labelStyle}>
          Additional details{" "}
          <span style={{ color: "var(--warm-mute)", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="details"
          rows={4}
          placeholder="Tell us what's wrong with this link."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      </div>

      <button
        type="submit"
        className="warm-btn warm-btn-accent warm-btn-lg"
        disabled={reportMutation.isLoading}
        style={{ justifyContent: "center" }}
      >
        {reportMutation.isLoading ? "Submitting..." : "Submit report"}
      </button>
    </form>
  );
}
