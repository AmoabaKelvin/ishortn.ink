// check if the user agent is a bot
export function isBot(userAgent: string) {
  return /bot|facebookexternalhit|google|bing|msnbot|slurp|yandex|duckduckgo|teoma|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|whatsapp|TelegramBot|Twitterbot|Discordbot|Applebot|Slackbot|facebookexternalhit|WhatsApp|Telegram|Instagram|Pinterest|Twitter|Facebook|LinkedIn|Google|Amazon|Snapchat|Reddit|Tumblr|VK|OK|OKHTTP|WhatsApp|Telegram|Instagram|Pinterest|Twitter|Facebook|LinkedIn|Google|Amazon|Snapchat|Reddit|Tumblr|VK|OK|OKHTTP|WhatsApp|Telegram|Instagram|Pinterest|Twitter|Facebook|LinkedIn|Google|Amazon|Snapchat|Reddit|Tumblr|VK|OK|OKHTTP/i.test(
    userAgent,
  );
}
