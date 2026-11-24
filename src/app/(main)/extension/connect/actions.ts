"use server";

import { redirect } from "next/navigation";

import { env } from "@/env.mjs";
import {
  connectResultUrl,
  parseConnectParams,
  parseRedirectUriList,
} from "@/lib/extension/connect";
import { api } from "@/trpc/server";

/**
 * The consent card's Connect button. A server action, so the request carries the Clerk session
 * and Next's Origin check stops other sites from posting it. The redirect URI is checked again
 * here: the form fields are as untrusted as the page's query.
 */
export async function connectExtension(formData: FormData) {
  const parsed = parseConnectParams(
    {
      redirect_uri: formData.get("redirect_uri"),
      state: formData.get("state"),
      label: formData.get("label"),
    },
    parseRedirectUriList(env.EXTENSION_REDIRECT_URIS),
  );
  if (!parsed.ok) throw new Error("Invalid extension connect request");

  const { redirectUri, state, label } = parsed.request;
  const { token } = await api.token.connectExtension.mutate({ label });
  redirect(connectResultUrl(redirectUri, { token, state }));
}
