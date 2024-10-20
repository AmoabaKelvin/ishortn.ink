import { geminiModel } from "@/ai";
import { generateObject } from "ai";
import { z } from "zod";

export async function generateAliasFromMetadata(metadata: {
  title?: string;
  description?: string;
  keywords?: string[];
  url: string;
}): Promise<Array<string>> {
  const result = await generateObject({
    model: geminiModel,
    schema: z.object({
      recommendations: z.array(z.string()),
    }),
    prompt: `You are a helpful assistant for a url shortening service, 
  your goal is to generate recommended aliases for the given metadata of a url in other to
  relieve the burden of thinking harrddd for an alias. Here is the metadata of the url:
  ${JSON.stringify(metadata)}
  Please generate a list of recommended aliases for the url.

  The alias should be:
  - Short (preferably 5-45 characters)
  - Memorable
  - Catchy
  - Relevant to the content
  - Lowercase, alphanumeric characters & underscores and hyphens only (no spaces or special characters)
  - Should not be more than 20 characters
  `,
  });

  return result.object.recommendations;
}
