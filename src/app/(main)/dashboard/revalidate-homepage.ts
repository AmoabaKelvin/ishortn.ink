"use server";

import { revalidatePath } from "next/cache";

export async function revalidateHomepage() {
  revalidatePath("/dashboard");
}

export async function revalidateRoute(path: string) {
  revalidatePath(path);
}
