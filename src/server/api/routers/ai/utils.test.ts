import { describe, expect, test } from "bun:test";

import { APICallError, RetryError } from "ai";

import { aiErrorLogFields } from "./utils";

const quotaMessage = "You exceeded your current quota, please check your plan and billing details.";

function quotaError() {
  return new APICallError({
    message: quotaMessage,
    url: "https://api.openai.com/v1/responses",
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({ error: { message: quotaMessage } }),
  });
}

describe("aiErrorLogFields", () => {
  test("keeps the class and status of a provider error, not its message", () => {
    const fields = aiErrorLogFields(quotaError());
    expect(fields).toEqual({ errorName: "AI_APICallError", statusCode: 429 });
    expect(JSON.stringify(fields)).not.toContain("quota");
  });

  test("unwraps the last error of a retried call", () => {
    const error = new RetryError({
      message: `Failed after 3 attempts. Last error: ${quotaMessage}`,
      reason: "maxRetriesExceeded",
      errors: [quotaError(), quotaError(), quotaError()],
    });
    const fields = aiErrorLogFields(error);
    expect(fields).toEqual({ errorName: "AI_APICallError", statusCode: 429, attempts: 3 });
    expect(JSON.stringify(fields)).not.toContain("quota");
  });

  test("reports only the name of other errors", () => {
    expect(aiErrorLogFields(new TypeError("fetch failed: secret-key"))).toEqual({
      errorName: "TypeError",
    });
    expect(aiErrorLogFields("boom")).toEqual({ errorName: "UnknownError" });
  });
});
