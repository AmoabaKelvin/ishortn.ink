import { describe, expect, test } from "bun:test";

import { createUtmTemplate } from "./utm-template.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { utmTemplate } from "@/server/db/schema";

function contextFor(plan: "free" | "pro" | "ultra") {
  const inserted: (typeof utmTemplate.$inferInsert)[] = [];
  // SAFETY: createUtmTemplate reads ctx.workspace and, past the plan check, calls
  // ctx.db.insert(table).values(row) once.
  const ctx = {
    db: {
      insert: () => ({
        values: async (row: typeof utmTemplate.$inferInsert) => {
          inserted.push(row);
          return [{ insertId: 1 }];
        },
      }),
    },
    workspace: {
      type: "personal",
      userId: "user_1",
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan,
    },
  } as WorkspaceTRPCContext;
  return { ctx, inserted };
}

describe("createUtmTemplate", () => {
  test("stays Ultra-only while per-link UTM fields are on Pro", async () => {
    for (const plan of ["free", "pro"] as const) {
      const { ctx, inserted } = contextFor(plan);
      await expect(createUtmTemplate(ctx, { name: "Newsletter" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(inserted).toEqual([]);
    }

    const { ctx, inserted } = contextFor("ultra");
    await createUtmTemplate(ctx, { name: "Newsletter", utmSource: "email" });
    expect(inserted).toHaveLength(1);
  });
});
