import { describe, expect, it } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { AiroStory } from "./_components/airo-story";
import { metadata } from "./page";

// The customer approved this copy word for word; one entry per block, in page order.
const APPROVED_COPY = [
  "AIRO stopped guessing which marketing works. Then they stopped paying for rack cards.",
  "Customer story: AIRO, Missouri and Arkansas",
  "AIRO is an aviation company that offers helicopter tours, charter flights and flight training in Missouri and Arkansas. Chris Lastra, AIRO's Marketing Manager, runs marketing for four markets with a small team, and each market has its own limited budget. AIRO has been on iShortn Pro for more than a year.",
  "The challenge",
  'Before iShortn, AIRO used direct links, or links with UTM codes. "They were difficult to keep track of," Chris says.',
  'The bigger problem was arguments without evidence. Managers and outside partners would tell Chris that a platform or campaign was doing good numbers for them. "I had no proof to back it up," he says.',
  'AIRO needed tracking it could trust, but not a full enterprise product built for much bigger companies. "This made sense to us at its price point," Chris says of iShortn.',
  "How AIRO uses iShortn",
  "In a normal week, AIRO uses iShortn to track and validate traffic from different sources. The team uses the tracking to see how well each partner and vertical is performing.",
  'The partner deals in Branson show how this works. "We might allow them to offer exclusive discounts but we expect a certain number of visits or conversions in turn," Chris explains. The click data shows whether the partner holds up its end.',
  'The feature Chris relies on most is analytics, "especially this time of year." The numbers he checks are plain ones. "Seeing clicks and unique visitors is the bread and butter."',
  "The result",
  'Those debates with managers and partners now end with data. "Now I can show them what really is and is not working so we\'re not relying on vibes to drive spending choices," Chris says.',
  "The latest decision was about rack cards, the printed brochures that sit in display racks. The numbers showed they weren't earning their place, so AIRO stopped using them in its Branson and Lake Ozark markets. \"That is going to be a few thousand dollars saved in both markets on spend that just wasn't working,\" Chris says. After checking the invoices, AIRO is cancelling at least $5,000 in rack card spend for next year.",
  "AIRO is using the same data right now to re-evaluate its entire marketing spend for 2027.",
  "There's a benefit for the team as well. \"As a manager, I also like using it because it allows me to credit my team's hard work with real numbers.\"",
  "Who Chris would recommend it to",
  '"I would easily recommend this to small marketing teams looking for an easy and inexpensive way to optimize their spending or prove whether a strategy is working."',
  "In his words",
  "\"iShortn is integral to our weekly reporting. It shows us which campaigns turn eyeballs into clicks and which don't, and it has saved us thousands of dollars. There's no more debate with stakeholders about what works, and we can hold partners to their promised numbers with a verifiable source of truth. I'd recommend it to any marketing team that wants real data behind its strategy instead of guesswork.\"",
  "Chris Lastra",
  "Marketing Manager, AIRO",
];

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ");

describe("AIRO customer story", () => {
  it("renders the approved copy verbatim and in order", () => {
    const page = text(renderToStaticMarkup(<AiroStory />));
    let from = 0;
    for (const block of APPROVED_COPY) {
      const at = page.indexOf(block, from);
      expect(at).toBeGreaterThanOrEqual(from);
      from = at + block.length;
    }
  });

  it("sets the approved title without the brand template", () => {
    expect(metadata.title).toEqual({
      absolute: "How AIRO cut $5,000 in rack card spend with iShortn",
    });
    expect(metadata.alternates?.canonical).toBe("/customers/airo");
  });
});
