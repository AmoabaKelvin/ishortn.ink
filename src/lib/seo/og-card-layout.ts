// Text fitting for the social card template (og-card.tsx). Satori has no auto-fit, so the
// headline size is picked here from an estimate of how the title wraps.

export const HEADLINE_SIZES = [76, 72, 68, 64, 60, 56, 52, 48] as const;
const SMALLEST_HEADLINE = 48;
export const HEADLINE_MAX_LINES = 3;
// Tallest headline block (lines × font size) that still leaves room for the eyebrow and a
// two-line subtitle between the lockup and the footer.
const HEADLINE_MAX_BLOCK = 168;
// Average advance of a Google Sans SemiBold glyph at -0.025em tracking, in em. Slightly above
// the measured mean so the estimate errs towards wrapping early.
const AVERAGE_GLYPH_EM = 0.53;

/** Lines a greedy word wrap needs for `text` at `fontSize` in a `width`-pixel column. */
export function estimateLines(text: string, fontSize: number, width: number): number {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * AVERAGE_GLYPH_EM)));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const needed = used === 0 ? word.length : used + 1 + word.length;
    if (needed <= charsPerLine) {
      used = needed;
    } else if (used === 0) {
      // A word longer than the line breaks across lines.
      lines += Math.ceil(word.length / charsPerLine) - 1;
      used = word.length % charsPerLine;
    } else {
      lines += 1;
      used = word.length;
    }
  }
  return lines;
}

/** Largest headline size whose wrapped title fits the column; the smallest size otherwise. */
export function headlineFontSize(title: string, width: number): number {
  for (const size of HEADLINE_SIZES) {
    const lines = estimateLines(title, size, width);
    if (lines <= HEADLINE_MAX_LINES && lines * size <= HEADLINE_MAX_BLOCK) return size;
  }
  return SMALLEST_HEADLINE;
}
