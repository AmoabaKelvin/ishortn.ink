import "server-only";

import pino, { type LoggerOptions } from "pino";

import { maskEmail } from "@/lib/utils/mask";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "*.authorization",
  "*.cookie",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.secret",
  "*.accessToken",
  "*.refreshToken",
  "*.clientSecret",
];

// Keys whose values are email addresses. Serializers mask these at the top
// level of any log record so call sites can pass raw emails without leaking
// PII. Add new keys here as they appear — the typed union documents intent.
const EMAIL_KEYS = [
  "email",
  "toEmail",
  "fromEmail",
  "recipient",
  "recipientEmail",
  "userEmail",
] as const;

const maskEmailSerializer = (v: unknown) =>
  typeof v === "string" ? maskEmail(v) : v;

const emailSerializers = Object.fromEntries(
  EMAIL_KEYS.map((k) => [k, maskEmailSerializer]),
);

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  base: { env: process.env.NODE_ENV },
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  serializers: emailSerializers,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProd || isTest
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,env",
            singleLine: false,
          },
        },
      }),
};

export const logger = pino(options);

export type Logger = typeof logger;
