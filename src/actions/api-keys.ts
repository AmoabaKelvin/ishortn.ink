"use server";

import { auth } from "@clerk/nextjs";
import { Unkey } from "@unkey/api";
import { revalidatePath } from "next/cache";

import { env } from "@/env.mjs";

const unkey = new Unkey({ token: env.UNKEY_TOKEN });

export const getUserAPIKeys = async () => {
  const { userId } = auth();
  const key = await unkey.apis.listKeys({
    apiId: env.UNKEY_API_ID,
    ownerId: userId!,
  });
  return key;
};

export const createAPIKey = async () => {
  const { userId } = auth();
  const key = await unkey.keys.create({
    apiId: env.UNKEY_API_ID,
    prefix: "ishortn",
    ownerId: userId!,
  });
  // revalidatePath("/dashboard/settings");
  return key;
};

export const revokeAPIKey = async (keyId: string) => {
  const key = await unkey.keys.delete({
    keyId,
  });
  revalidatePath("/dashboard/settings");
  return key;
};

export const revalidatePathForDashboard = () => {
  revalidatePath("/dashboard/settings");
};
