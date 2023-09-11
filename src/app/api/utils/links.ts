import * as crypto from "crypto";

const base62Encode = (num: number): string => {
  const base62 =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  let current = num;

  if (current === 0) {
    return base62[0];
  }

  while (current > 0) {
    result = base62[current % 62] + result;
    current = Math.floor(current / 62);
  }

  return result;
};

const generateSHA256Hash = (data: string): string => {
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  return hash;
};

export const generateShortUrl = async (url: string): Promise<string> => {
  const hash = generateSHA256Hash(url);
  const hashInt = parseInt(hash.substr(0, 8), 16);
  const shortUrl = base62Encode(hashInt);
  return shortUrl;
};
