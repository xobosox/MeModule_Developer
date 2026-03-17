import type Anthropic from "@anthropic-ai/sdk";

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "chat",
    description:
      "Send a message to the user. Use this for explanations, questions, confirmations, or any conversational response.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The message content to display to the user.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or update a file in the project. The path should be relative to the project root.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "The file path relative to the project root (e.g., 'src/App.tsx').",
        },
        content: {
          type: "string",
          description: "The full content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "show_preview",
    description:
      "Show an HTML wireframe or preview to the user in the preview panel. Use this to present UI mockups or interactive previews.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The HTML content to render in the preview panel.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "show_plan",
    description:
      "Show an HTML plan or diagram to the user. Use this to present architecture plans, flowcharts, or step-by-step outlines.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description:
            "The HTML content for the plan or diagram to display to the user.",
        },
      },
      required: ["content"],
    },
  },
];
