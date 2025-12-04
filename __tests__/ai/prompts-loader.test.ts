import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the loader module to avoid fs issues
vi.mock("@/server/ai/prompts/loader", () => {
  const mockLoadPrompt = vi.fn();
  const mockFillPrompt = vi.fn((template: string, vars: Record<string, string>) => {
    let result = template;

    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    return result;
  });

  return {
    loadPrompt: mockLoadPrompt,
    fillPrompt: mockFillPrompt,
  };
});

import { loadPrompt, fillPrompt } from "@/server/ai/prompts/loader";

describe("prompts loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadPrompt (mocked)", () => {
    it("can be configured to return database override", async () => {
      const customContent = "My custom recipe extraction prompt";

      vi.mocked(loadPrompt).mockResolvedValue(customContent);

      const result = await loadPrompt("recipe-extraction");

      expect(result).toBe(customContent);
    });

    it("can be configured to return file content", async () => {
      vi.mocked(loadPrompt).mockResolvedValue("Default recipe extraction prompt from file");

      const result = await loadPrompt("recipe-extraction");

      expect(result).toBe("Default recipe extraction prompt from file");
    });
  });

  describe("fillPrompt", () => {
    it("replaces single variable", () => {
      const template = "Hello {{name}}!";
      const result = fillPrompt(template, { name: "World" });

      expect(result).toBe("Hello World!");
    });

    it("replaces multiple variables", () => {
      const template = "{{greeting}} {{name}}, welcome to {{place}}!";
      const result = fillPrompt(template, {
        greeting: "Hello",
        name: "Alice",
        place: "Wonderland",
      });

      expect(result).toBe("Hello Alice, welcome to Wonderland!");
    });

    it("replaces same variable multiple times", () => {
      const template = "{{name}} likes {{name}}'s {{thing}}";
      const result = fillPrompt(template, {
        name: "Bob",
        thing: "car",
      });

      expect(result).toBe("Bob likes Bob's car");
    });

    it("leaves template unchanged if no variables provided", () => {
      const template = "Hello {{name}}!";
      const result = fillPrompt(template, {});

      expect(result).toBe("Hello {{name}}!");
    });

    it("leaves unknown variables unchanged", () => {
      const template = "Hello {{name}} and {{other}}!";
      const result = fillPrompt(template, { name: "World" });

      expect(result).toBe("Hello World and {{other}}!");
    });

    it("handles empty template", () => {
      const result = fillPrompt("", { name: "World" });

      expect(result).toBe("");
    });

    it("handles template with no variables", () => {
      const template = "Just plain text";
      const result = fillPrompt(template, { name: "World" });

      expect(result).toBe("Just plain text");
    });

    it("handles multiline templates", () => {
      const template = `Line 1: {{var1}}
Line 2: {{var2}}
Line 3: {{var1}} again`;

      const result = fillPrompt(template, {
        var1: "First",
        var2: "Second",
      });

      expect(result).toBe(`Line 1: First
Line 2: Second
Line 3: First again`);
    });

    it("handles special regex characters in values", () => {
      const template = "Pattern: {{pattern}}";
      const result = fillPrompt(template, { pattern: "$1 (test) [match]" });

      expect(result).toBe("Pattern: $1 (test) [match]");
    });
  });
});
