import { readFileSync } from "fs";
import { join } from "path";

import { getConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys, type ServerConfigKey } from "@/server/db/zodSchemas/server-config";
import type { PromptConfig } from "@/server/db/zodSchemas/server-config";

const PROMPTS_DIR = join(process.cwd(), "server", "ai", "prompts");

const PROMPT_NAME_TO_CONFIG_KEY: Record<string, ServerConfigKey> = {
  "recipe-extraction": ServerConfigKeys.PROMPT_RECIPE_EXTRACTION,
  "unit-conversion": ServerConfigKeys.PROMPT_UNIT_CONVERSION,
};

export async function loadPrompt(name: string): Promise<string> {
  // Check if there's a database override for this prompt
  const configKey = PROMPT_NAME_TO_CONFIG_KEY[name];

  if (configKey) {
    const override = await getConfig(configKey);

    if (override && typeof override === "object" && "content" in override) {
      return (override as PromptConfig).content;
    }
  }

  // Fall back to file-based prompt
  const filePath = join(PROMPTS_DIR, `${name}.txt`);

  return readFileSync(filePath, "utf-8");
}

export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
