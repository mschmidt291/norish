import * as cheerio from "cheerio";

import { getAIProvider } from "./providers/factory";
import { jsonLdRecipeSchema } from "./schemas/jsonld-recipe";
import { loadPrompt } from "./prompts/loader";

import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { normalizeRecipeFromJson } from "@/lib/parser/normalize";
import { getUnits, isAIEnabled } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

function extractSanitizedBody(html: string): string {
  try {
    const $ = cheerio.load(html);
    const $body = $("body");

    if ($body.length === 0) return html;

    $body.find("script, style, noscript, svg, iframe, canvas, link, meta, header, footer").remove();

    const blocks: string[] = [];
    const selectors = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,figcaption,time,span,img,picture,source";

    $body.find(selectors).each((_, el) => {
      const name = (el as any).name?.toLowerCase?.();

      if (name === "img") {
        const alt = ($(el).attr("alt") || "").trim();
        const src = (
          $(el).attr("src") ||
          $(el).attr("data-src") ||
          $(el).attr("data-lazy-src") ||
          ""
        ).trim();
        const srcset = ($(el).attr("srcset") || "").trim();
        const url =
          src ||
          srcset
            .split(",")
            .map((s) => s.trim().split(" ")[0])
            .find(Boolean) ||
          "";

        if (url) blocks.push(`[img] ${alt ? alt + " | " : ""}${url}`.trim());

        return;
      }
      const t = $(el).text().trim();

      if (t) blocks.push(t);
    });

    return blocks
      .join("\n")
      .replace(/\r/g, "")
      .replace(/[\t ]{2,}/g, " ");
  } catch {
    return html;
  }
}

async function buildExtractionPrompt(url: string | undefined, html: string): Promise<string> {
  const sanitized = extractSanitizedBody(html);
  const truncated = sanitized.slice(0, 50000);

  const prompt = await loadPrompt("recipe-extraction");

  return `${prompt}
${url ? `URL: ${url}\n` : ""}
WEBPAGE TEXT:
${truncated}`;
}

export async function extractRecipeWithAI(
  html: string,
  url?: string
): Promise<FullRecipeInsertDTO | null> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping extraction");

    return null;
  }

  aiLogger.info({ url }, "Starting AI recipe extraction");

  const provider = await getAIProvider();
  const prompt = await buildExtractionPrompt(url, html);

  aiLogger.debug({ url, promptLength: prompt.length }, "Sending prompt to AI provider");

  const jsonLd = await provider.generateStructuredOutput<any>(
    prompt,
    jsonLdRecipeSchema,
    "You extract recipe data as JSON-LD with both metric and US measurements. Return {} if insufficient data."
  );

  if (!jsonLd || Object.keys(jsonLd).length === 0) {
    aiLogger.error({ url }, "Empty or null response from AI provider");

    return null;
  }

  aiLogger.debug(
    {
      url,
      recipeName: jsonLd.name,
      metricIngredients: jsonLd.recipeIngredient?.metric?.length ?? 0,
      usIngredients: jsonLd.recipeIngredient?.us?.length ?? 0,
      metricSteps: jsonLd.recipeInstructions?.metric?.length ?? 0,
      usSteps: jsonLd.recipeInstructions?.us?.length ?? 0,
    },
    "AI response received"
  );

  if (
    !jsonLd.name ||
    !jsonLd.recipeIngredient?.metric?.length ||
    !jsonLd.recipeIngredient?.us?.length ||
    !jsonLd.recipeInstructions?.metric?.length ||
    !jsonLd.recipeInstructions?.us?.length
  ) {
    aiLogger.error("Invalid recipe data - missing required fields");

    return null;
  }

  const metricVersion = {
    ...jsonLd,
    recipeIngredient: jsonLd.recipeIngredient.metric,
    recipeInstructions: jsonLd.recipeInstructions.metric,
  };

  const normalized = await normalizeRecipeFromJson(metricVersion);

  if (!normalized) {
    aiLogger.error("Failed to normalize recipe from JSON-LD");

    return null;
  }

  const units = await getUnits();
  const usIngredients = parseIngredientWithDefaults(jsonLd.recipeIngredient.us, units);
  const usSteps = jsonLd.recipeInstructions.us.map((step: string, i: number) => ({
    step,
    order: i + 1,
    systemUsed: "us" as const,
  }));

  // Combine both systems
  normalized.url = url ?? null;
  normalized.recipeIngredients = [
    ...(normalized.recipeIngredients ?? []), // metric from normalizer
    ...usIngredients.map((ing, i) => ({
      ingredientId: null,
      ingredientName: ing.description,
      amount: ing.quantity != null ? ing.quantity : null,
      unit: ing.unitOfMeasureID,
      systemUsed: "us" as const,
      order: i,
    })),
  ];
  normalized.steps = [
    ...(normalized.steps ?? []), // metric from normalizer
    ...usSteps,
  ];

  aiLogger.info(
    {
      url,
      recipeName: normalized.name,
      totalIngredients: normalized.recipeIngredients?.length ?? 0,
      totalSteps: normalized.steps?.length ?? 0,
      systemUsed: normalized.systemUsed,
    },
    "AI recipe extraction completed"
  );

  return normalized;
}
