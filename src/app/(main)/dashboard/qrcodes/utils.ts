import { staticQrPayloadSchema } from "@/lib/qr-generator/payload";
import { PDF_MAX_SIZE_CM, PDF_MIN_SIZE_CM } from "@/lib/qr-generator/pdf";
import { defaultGeneratorState } from "@/lib/qr-generator/state";
import { generateQRCodeSvg } from "@/lib/qr-generator/svg";
import { logoImageSchema } from "@/server/api/routers/qrcode/qrcode.input";

import type {
  StaticQrPayload,
  StaticQrPayloadType,
  WifiSecurity,
} from "@/lib/qr-generator/payload";
import type { QRCodeGeneratorState, QRCodeStyle } from "@/lib/qr-generator/types";
import type { RouterOutputs } from "@/trpc/shared";

export const SVG_EFFECTS_NOTE = "SVG uses the plain style; effects are PNG only";
export const SVG_LEGACY_NOTE = "SVG uses the plain style for codes made before SVG export";

// While the subscription is loading (or failed to load) creation stays allowed: the server enforces
// the limit on create, and blocking on an unknown state would lock out users who are under it.
export function checkIfUserCanCreateMoreQRCodes(
  subDetails: RouterOutputs["subscriptions"]["get"] | undefined,
) {
  const qrCodes = subDetails?.usage.qrCodes;
  if (!qrCodes || qrCodes.limit === null) return true;
  return qrCodes.count < qrCodes.limit;
}

export function qrCodeFileName(title: string | null | undefined, extension = "png") {
  const slug = (title ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${slug || "qr-code"}.${extension}`;
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type SavedQrCodeRow = RouterOutputs["qrCode"]["list"][number];
type SavedQrCode = Pick<SavedQrCodeRow, "style" | "color"> &
  Partial<Pick<SavedQrCodeRow, "contentType" | "content">> & {
    link: Pick<NonNullable<SavedQrCodeRow["link"]>, "domain" | "alias"> | null;
  };

/**
 * Generator state for a saved code's SVG: the short link its PNG encodes (or a static code's own
 * content), drawn with the style saved at creation. Codes saved before styles were stored get the
 * plain style in their saved colour. Null for legacy codes without a link or a saved style.
 */
export function savedQrCodeSvgState(qr: SavedQrCode): QRCodeGeneratorState | null {
  let text: string;
  if (qr.link) {
    text = `https://${qr.link.domain}/${qr.link.alias}`;
  } else if (qr.contentType === "text" && qr.content && qr.style) {
    text = qr.content;
  } else {
    return null;
  }
  const base = { ...defaultGeneratorState(), text, scale: 20 };
  if (!qr.style) {
    const darkColor = /^#[0-9a-f]{6}$/i.test(qr.color) ? qr.color : "#000000";
    return { ...base, seed: 0, pixelStyle: "square", markerFrame: "square", darkColor };
  }
  return { ...base, ...qr.style, logoImage: qr.style.logoImage ?? undefined };
}

export function svgNoteFor(qr: Pick<SavedQrCode, "style">) {
  if (!qr.style) return SVG_LEGACY_NOTE;
  return qr.style.effect === "none" ? null : SVG_EFFECTS_NOTE;
}

/** The SVG note for another vector format ("PDF uses the plain style…"). */
export function vectorNoteFor(qr: Pick<SavedQrCode, "style">, format: string) {
  return svgNoteFor(qr)?.replace(/^SVG/, format) ?? null;
}

/**
 * The image to show for a saved code. Codes made by a CSV import store no PNG; they are drawn
 * from their saved style instead (without the logo, which an SVG in an <img> can't load).
 */
export function qrPreviewSrc(qr: SavedQrCode & { qrCode: string | null }): string | null {
  if (qr.qrCode) return qr.qrCode;
  const state = savedQrCodeSvgState(qr);
  if (!state) return null;
  const svg = generateQRCodeSvg({ ...state, logoImage: undefined, scale: 4 });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * File names (without extension) for codes in a ZIP: the short link's alias, or the title for
 * codes without a link. Characters file systems reject become hyphens, and repeats (the same
 * alias on two domains, or names differing only in case) get a numbered suffix.
 */
export function qrZipBaseNames(
  codes: { alias?: string | null; title?: string | null }[],
): string[] {
  const used = new Set<string>();
  return codes.map((code) => {
    const fromAlias = (code.alias ?? "")
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 100);
    const base = fromAlias || qrCodeFileName(code.title).replace(/\.png$/, "");
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}`;
    used.add(name.toLowerCase());
    return name;
  });
}

/**
 * The subset of the generator state saved with a code. `logoImage` should come from
 * `toLogoDataUri`; a logo the save input would reject is left out so the code still saves, and its
 * SVG is drawn without the logo.
 */
export function qrCodeStyleFrom(
  state: QRCodeGeneratorState,
  logoImage: string | undefined,
): QRCodeStyle {
  return {
    pixelStyle: state.pixelStyle,
    markerFrame: state.markerFrame,
    markerCenter: state.markerCenter,
    darkColor: state.darkColor,
    lightColor: state.lightColor,
    // The generator switches to H whenever a logo is set, even if the logo then fails to load.
    ecc: state.logoImage ? "H" : state.ecc,
    margin: state.margin,
    seed: state.seed,
    marginNoise: state.marginNoise,
    marginNoiseRate: state.marginNoiseRate,
    effect: state.effect,
    logoImage: logoImage && logoImageSchema.safeParse(logoImage).success ? logoImage : null,
    logoSize: state.logoSize,
    logoMargin: state.logoMargin,
    logoBorderRadius: state.logoBorderRadius,
  };
}

export function saveSvg(svg: string, fileName: string) {
  saveBlob(new Blob([svg], { type: "image/svg+xml" }), fileName);
}

/**
 * The print size in centimetres for the PDF dialog's choice: a preset ("2", "3", "5") or
 * "custom" with the typed value. Returns an error message for a custom size out of range.
 */
export function pdfSizeCm(choice: string, custom: string): { cm: number } | { error: string } {
  const value = choice === "custom" ? Number(custom.replace(",", ".")) : Number(choice);
  if (!Number.isFinite(value) || value < PDF_MIN_SIZE_CM || value > PDF_MAX_SIZE_CM) {
    return { error: `Enter a size from ${PDF_MIN_SIZE_CM} to ${PDF_MAX_SIZE_CM} cm` };
  }
  return { cm: Math.round(value * 10) / 10 };
}

/**
 * How many QR codes one bulk batch (a CSV import or a ZIP download) may hold: 0 when bulk QR isn't
 * on the plan, null when unlimited. Team workspaces have Ultra features. The server enforces the
 * import limit; ZIPs are built in the browser from codes the user can already download.
 */
export function bulkQrLimitFor(
  subDetails: Pick<RouterOutputs["subscriptions"]["get"], "isTeamWorkspace" | "caps"> | undefined,
): number | null {
  if (!subDetails) return null;
  if (subDetails.isTeamWorkspace) return null;
  return subDetails.caps.bulkQrBatchLimit ?? null;
}

/** Every static-type form field; the active type reads the ones it needs. */
export type StaticFormValues = {
  text: string;
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
  to: string;
  subject: string;
  body: string;
  phone: string;
  message: string;
};

export const emptyStaticFormValues: StaticFormValues = {
  text: "",
  ssid: "",
  password: "",
  security: "WPA",
  hidden: false,
  to: "",
  subject: "",
  body: "",
  phone: "",
  message: "",
};

// SAFETY: Object.keys of a StaticFormValues literal lists exactly its keys.
const STATIC_FIELD_NAMES = Object.keys(emptyStaticFormValues) as (keyof StaticFormValues)[];

/** The unvalidated payload for `staticQrPayloadSchema` from the form's fields. */
export function staticPayloadFrom(type: StaticQrPayloadType, values: StaticFormValues) {
  switch (type) {
    case "text":
      return { type, text: values.text };
    case "wifi":
      return {
        type,
        ssid: values.ssid,
        password: values.password,
        security: values.security,
        hidden: values.hidden,
      };
    case "email":
      return { type, to: values.to, subject: values.subject, body: values.body };
    case "sms":
      return { type, phone: values.phone, message: values.message };
    case "phone":
      return { type, phone: values.phone };
  }
}

/** A saved static code's type, or null for link codes and legacy codes. */
export function staticTypeOf(
  qr: Pick<SavedQrCodeRow, "contentType" | "payloadFields">,
): StaticQrPayloadType | null {
  if (qr.contentType !== "text") return null;
  return qr.payloadFields?.type ?? "text";
}

/** The form fields to re-open a saved static code with. */
export function staticFormValuesFrom(
  qr: Pick<SavedQrCodeRow, "content" | "payloadFields">,
): StaticFormValues {
  const payload: StaticQrPayload = qr.payloadFields ?? { type: "text", text: qr.content };
  const { type: _type, ...fields } = payload;
  return { ...emptyStaticFormValues, ...fields };
}

export type StaticFormResult =
  | { ok: true; payload: StaticQrPayload }
  | { ok: false; fieldErrors: Partial<Record<keyof StaticFormValues, string>>; message: string };

/** Validates the active type's fields: the first message per field, plus one for a toast. */
export function validateStaticForm(
  type: StaticQrPayloadType,
  values: StaticFormValues,
): StaticFormResult {
  const result = staticQrPayloadSchema.safeParse(staticPayloadFrom(type, values));
  if (result.success) return { ok: true, payload: result.data };

  const fieldErrors: Partial<Record<keyof StaticFormValues, string>> = {};
  for (const issue of result.error.issues) {
    const name = STATIC_FIELD_NAMES.find((field) => field === issue.path[0]);
    if (name) fieldErrors[name] ??= issue.message;
  }
  return { ok: false, fieldErrors, message: result.error.issues[0]?.message ?? "Check the fields" };
}
