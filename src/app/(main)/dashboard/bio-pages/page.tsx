import { api } from "@/trpc/server";

import { BioPagesList } from "./_components/bio-pages-list";

export const dynamic = "force-dynamic";

async function BioPagesPage() {
  const [pages, sub] = await Promise.all([
    api.bioPage.list.query(),
    api.subscriptions.get.query(),
  ]);

  return (
    <BioPagesList
      pages={pages}
      plan={sub.plan}
      bioPageLimit={sub.caps.bioPageLimit ?? null}
    />
  );
}

export default BioPagesPage;
