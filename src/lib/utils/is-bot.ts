import { isBot as uaIsBot } from "ua-parser-js/bot-detection";

export function isBot(userAgent: string): boolean {
  if (!userAgent) return false;
  return uaIsBot(userAgent);
}
