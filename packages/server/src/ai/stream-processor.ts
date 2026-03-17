import Anthropic from "@anthropic-ai/sdk";
import type { WebSocket } from "ws";
import { toolDefinitions } from "./tool-definitions.js";

export interface ToolCallOutput {
  type: "chat" | "file" | "preview" | "plan";
  path?: string;
  content: string;
}

export function processToolCall(
  toolName: string,
  input: Record<string, string>
): ToolCallOutput | null {
  switch (toolName) {
    case "chat":
      return { type: "chat", content: input.content };
    case "write_file":
      return { type: "file", path: input.path, content: input.content };
    case "show_preview":
      return { type: "preview", content: input.content };
    case "show_plan":
      return { type: "plan", content: input.content };
    default:
      return null;
  }
}

export interface StreamParams {
  ws: WebSocket;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  abortSignal?: AbortSignal;
  onChatMessage?: (content: string) => void;
  onToolCall?: (result: ToolCallOutput) => void;
}

function wsSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export async function streamAiResponse(params: StreamParams): Promise<void> {
  const { ws, systemPrompt, messages, abortSignal, onChatMessage, onToolCall } =
    params;

  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6-20250627";
  const client = new Anthropic();

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages,
    tools: toolDefinitions,
  });

  let currentTextContent = "";
  let currentToolName = "";
  let currentToolInput = "";

  for await (const event of stream) {
    if (abortSignal?.aborted) {
      stream.abort();
      break;
    }

    switch (event.type) {
      case "content_block_start": {
        currentTextContent = "";
        currentToolName = "";
        currentToolInput = "";
        if (event.content_block.type === "tool_use") {
          currentToolName = event.content_block.name;
        }
        break;
      }

      case "content_block_delta": {
        if (event.delta.type === "text_delta") {
          currentTextContent += event.delta.text;
          wsSend(ws, {
            type: "chat",
            content: currentTextContent,
            streaming: true,
          });
        } else if (event.delta.type === "input_json_delta") {
          currentToolInput += event.delta.partial_json;
        }
        break;
      }

      case "content_block_stop": {
        if (currentTextContent) {
          wsSend(ws, {
            type: "chat",
            content: currentTextContent,
            streaming: false,
          });
          onChatMessage?.(currentTextContent);
          currentTextContent = "";
        }

        if (currentToolName) {
          try {
            const input = JSON.parse(currentToolInput || "{}");
            const result = processToolCall(currentToolName, input);
            if (result) {
              wsSend(ws, {
                type: result.type,
                path: result.path,
                content: result.content,
              });
              onToolCall?.(result);
            }
          } catch {
            console.error("Failed to parse tool input:", currentToolInput);
          }
          currentToolName = "";
          currentToolInput = "";
        }
        break;
      }
    }
  }

  wsSend(ws, { type: "generation_complete" });
}
