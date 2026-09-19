"use client";

import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ABUSE_CATEGORY_LABELS, abuseCategoryValues } from "@/server/api/routers/abuse/abuse.input";
import { api } from "@/trpc/react";

import { bodyClass, buttonClass, cardClass, h3Class } from "../_components/site-primitives";

const labelClass = "block text-base font-medium text-neutral-900 sm:text-sm";
// 16px text on every control so iOS does not zoom on focus
const fieldClass =
  "mt-2 block w-full rounded-[10px] bg-white px-3 py-2.5 text-base text-neutral-900 shadow-site-btn placeholder:text-neutral-500 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-900";
const optionalClass = "font-normal text-neutral-600";

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
      <div className={cn(cardClass, "mx-auto max-w-xl p-6 text-center sm:p-8")}>
        <h2 className={h3Class}>Report received</h2>
        <p className={cn(bodyClass, "mt-3")}>
          Thank you. Our team reviews every report and takes action on links that violate our
          policies. If you left an email, we may reach out for more detail.
        </p>
        <button
          type="button"
          className={cn(buttonClass({ variant: "secondary" }), "mt-6")}
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
      className={cn(cardClass, "mx-auto grid max-w-xl gap-5 p-6 sm:p-8")}
      onSubmit={handleSubmit}
    >
      <div>
        <label htmlFor="shortUrl" className={labelClass}>
          Short link <span aria-hidden="true">*</span>
        </label>
        <input
          id="shortUrl"
          type="text"
          required
          placeholder="ishortn.ink/abc"
          value={shortUrl}
          onChange={(e) => setShortUrl(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="category" className={labelClass}>
          Reason <span aria-hidden="true">*</span>
        </label>
        <select
          id="category"
          required
          value={category}
          onChange={(e) => {
            const selected = abuseCategoryValues.find((value) => value === e.target.value);
            if (selected) setCategory(selected);
          }}
          className={fieldClass}
        >
          {abuseCategoryValues.map((value) => (
            <option key={value} value={value}>
              {ABUSE_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="reporterEmail" className={labelClass}>
          Your email <span className={optionalClass}>(optional)</span>
        </label>
        <input
          id="reporterEmail"
          type="email"
          placeholder="you@example.com"
          value={reporterEmail}
          onChange={(e) => setReporterEmail(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="details" className={labelClass}>
          Additional details <span className={optionalClass}>(optional)</span>
        </label>
        <textarea
          id="details"
          rows={4}
          placeholder="Tell us what's wrong with this link."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className={cn(fieldClass, "resize-y")}
        />
      </div>

      <button
        type="submit"
        className={cn(buttonClass({ variant: "primary", size: "lg" }), "w-full")}
        disabled={reportMutation.isLoading}
      >
        {reportMutation.isLoading ? "Submitting..." : "Submit report"}
      </button>
    </form>
  );
}
