"use client";

import { useState, useEffect } from "react";
import { Button, Textarea, Select, SelectItem, Chip } from "@heroui/react";
import { CheckIcon, ArrowPathIcon } from "@heroicons/react/16/solid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

type PromptName = "recipe-extraction" | "unit-conversion";

const PROMPT_LABELS: Record<PromptName, string> = {
  "recipe-extraction": "Recipe Extraction",
  "unit-conversion": "Unit Conversion",
};

const PROMPT_DESCRIPTIONS: Record<PromptName, string> = {
  "recipe-extraction":
    "This prompt is used to extract recipe data from webpage content and convert it to structured JSON.",
  "unit-conversion":
    "This prompt is used to convert recipe measurements between metric and US systems.",
};

export default function PromptsForm() {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptName>("recipe-extraction");
  const [content, setContent] = useState("");
  const [defaultContent, setDefaultContent] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.admin.prompts.getPrompt.queryKey({ name: selectedPrompt });
  const { data: promptData, isLoading } = useQuery(
    trpc.admin.prompts.getPrompt.queryOptions({ name: selectedPrompt })
  );

  const refetch = () => queryClient.invalidateQueries({ queryKey });

  const updateMutation = useMutation(
    trpc.admin.prompts.updatePrompt.mutationOptions({
      onSuccess: () => {
        refetch();
      },
    })
  );

  const resetMutation = useMutation(
    trpc.admin.prompts.resetPrompt.mutationOptions({
      onSuccess: () => {
        refetch();
      },
    })
  );

  useEffect(() => {
    if (promptData) {
      setContent(promptData.content);
      setDefaultContent(promptData.defaultContent);
      setIsCustom(promptData.isCustom);
    }
  }, [promptData]);

  const handleSave = async () => {
    if (content === defaultContent) {
      // If content matches default, reset instead of saving
      await resetMutation.mutateAsync({ name: selectedPrompt });
    } else {
      await updateMutation.mutateAsync({
        name: selectedPrompt,
        content,
      });
    }
  };

  const handleReset = async () => {
    await resetMutation.mutateAsync({ name: selectedPrompt });
  };

  const hasChanges = content !== promptData?.content;
  const isDefault = content === defaultContent;

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between gap-4">
        <Select
          className="max-w-xs"
          label="Select Prompt"
          selectedKeys={[selectedPrompt]}
          onSelectionChange={(keys) => setSelectedPrompt(Array.from(keys)[0] as PromptName)}
        >
          <SelectItem key="recipe-extraction">{PROMPT_LABELS["recipe-extraction"]}</SelectItem>
          <SelectItem key="unit-conversion">{PROMPT_LABELS["unit-conversion"]}</SelectItem>
        </Select>

        {isCustom && (
          <Chip color="primary" size="sm" variant="flat">
            Custom
          </Chip>
        )}
      </div>

      <div className="text-default-500 text-sm">{PROMPT_DESCRIPTIONS[selectedPrompt]}</div>

      <Textarea
        classNames={{
          input: "font-mono text-sm",
        }}
        isDisabled={isLoading}
        label="Prompt Content"
        maxRows={20}
        minRows={10}
        placeholder="Enter prompt content..."
        value={content}
        onValueChange={setContent}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="text-default-500 text-xs">
          {isDefault ? "Using default prompt" : "Modified from default"}
        </div>

        <div className="flex gap-2">
          {!isDefault && (
            <Button
              isDisabled={isLoading || updateMutation.isPending}
              isLoading={resetMutation.isPending}
              startContent={<ArrowPathIcon className="h-4 w-4" />}
              variant="flat"
              onPress={handleReset}
            >
              Reset to Default
            </Button>
          )}

          <Button
            color="primary"
            isDisabled={!hasChanges || isLoading || resetMutation.isPending}
            isLoading={updateMutation.isPending}
            startContent={<CheckIcon className="h-4 w-4" />}
            onPress={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
