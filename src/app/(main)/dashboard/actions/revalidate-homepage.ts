"use server";

import { revalidatePath } from "next/cache";

export async function revalidateHomepage() {
  console.log("Revalidating homepage");
  revalidatePath("/dashboard");
}
