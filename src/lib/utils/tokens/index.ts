import crypto from "crypto";
import { customAlphabet } from "nanoid";

import prisma from "@/db";

export const hashToken = (key: string) => {
  return crypto.createHash("sha256").update(key).digest("hex");
};

export const generateToken = () => {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, 28);

  return nanoid();
};

export const generateHashedToken = async (token: string) => {
  const hashedToken = hashToken(token);

  return token.slice(0, 7) + hashedToken;
};

export const verifyToken = async (token: string) => {
  const hashedToken = hashToken(token);

  const tokenAndHash = token.slice(0, 7) + hashedToken;

  const result = await prisma.token.findFirst({
    where: {
      token: tokenAndHash,
    },
  });

  return result;
};
