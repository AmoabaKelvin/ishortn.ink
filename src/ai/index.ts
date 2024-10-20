import { google } from "@ai-sdk/google";

export const geminiModel = google("gemini-1.5-flash-002", {
  structuredOutputs: false,
});
