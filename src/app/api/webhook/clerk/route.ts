import { headers } from "next/headers";
import { Resend } from "resend";
import { Webhook } from "svix";

import prisma from "@/db";
import { env } from "@/env.mjs";
import { WebhookEvent } from "@clerk/nextjs/server";

import WelcomeEmail from "../../../../../emails/welcome-email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local",
    );
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new SVIX instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook with and ID of ${id} and type of ${eventType}`);
  console.log("Webhook body:", body);

  // Get the user info
  const userInfo = getUserInfo(payload);

  await prisma.user.upsert({
    where: { id: id! },
    update: {
      name: userInfo.name,
      email: userInfo.email,
      imageUrl: userInfo.avatarUrl,
    },
    create: {
      id: id!,
      name: userInfo.name,
      email: userInfo.email,
      imageUrl: userInfo.avatarUrl,
    },
  });

  const { data, error } = await resend.emails.send({
    from: "kelvin@ishortn.ink",
    to: userInfo.email,
    subject: "Welcome to iShortn",
    react: WelcomeEmail({
      userFirstname: userInfo.name.split(" ")[0],
    }),
  });

  if (error) {
    console.error("Error sending email:", error);
  }

  // Return a 201 status code

  return new Response("", { status: 201 });
}

interface EmailAddress {
  email_address: string;
  id: string;
  linked_to: Array<{ id: string; type: string }>;
  object: string;
  reserved: boolean;
  verification: {
    attempts: null | number;
    expire_at: null | number;
    status: string;
    strategy: string;
  };
}

interface ExternalAccount {
  approved_scopes: string;
  avatar_url: string;
  email_address: string;
  first_name: string;
  id: string;
  identification_id: string;
  image_url: string;
  label: null | string;
  last_name: string;
  object: string;
  provider: string;
  provider_user_id: string;
  public_metadata: {};
  username: string;
  verification: {
    attempts: null | number;
    expire_at: null | number;
    status: string;
    strategy: string;
  };
}

interface Payload {
  data: {
    backup_code_enabled: boolean;
    banned: boolean;
    birthday: string;
    create_organization_enabled: boolean;
    created_at: number;
    delete_self_enabled: boolean;
    email_addresses: EmailAddress[];
    external_accounts: ExternalAccount[];
    external_id: null | string;
    first_name: string;
    gender: string;
    has_image: boolean;
    id: string;
    image_url: string;
    last_name: string;
    last_sign_in_at: null | number;
    locked: boolean;
    object: string;
    password_enabled: boolean;
    phone_numbers: any[];
    primary_email_address_id: string;
    primary_phone_number_id: null | string;
    primary_web3_wallet_id: null | string;
    private_metadata: {};
    profile_image_url: string;
    public_metadata: {};
    saml_accounts: any[];
    totp_enabled: boolean;
    two_factor_enabled: boolean;
    unsafe_metadata: {};
    updated_at: number;
    username: string;
    web3_wallets: any[];
  };
  object: string;
  type: string;
}

function getUserInfo(payload: Payload) {
  const data = payload.data;
  const emailData = data.email_addresses[0];
  const externalAccountData = data.external_accounts[0];

  const userInfo = {
    name: `${data.first_name} ${data.last_name}`,
    email: emailData.email_address,
    avatarUrl: data.image_url,
  };

  return userInfo;
}
