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
  tools?: Anthropic.Tool[];
  onChatMessage?: (content: string) => void;
  onToolCall?: (result: ToolCallOutput) => void;
}

function wsSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    console.warn(`WebSocket not open (state=${ws.readyState}), dropping message:`, JSON.stringify(data).slice(0, 100));
  }
}

export async function streamAiResponse(params: StreamParams): Promise<void> {
  const { ws, systemPrompt, messages, abortSignal, onChatMessage, onToolCall } =
    params;

  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
  const client = new Anthropic();

  console.log(`Calling Claude ${model} with ${messages.length} messages, ${(params.tools ?? toolDefinitions).length} tools, system prompt length: ${systemPrompt.length}`);

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages,
    tools: params.tools ?? toolDefinitions,
  });

  stream.on("error", (err) => {
    console.error("Stream error event:", err);
  });

  let currentTextContent = "";
  let currentToolName = "";
  let currentToolInput = "";

  let eventCount = 0;
  try {
  for await (const event of stream) {
    eventCount++;
    if (eventCount <= 5) {
      console.log(`Stream event #${eventCount}: type=${event.type}`, event.type === "content_block_start" ? `block_type=${(event as any).content_block?.type}` : "");
    }
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
          console.log(`Tool call completed: ${currentToolName}, input length: ${currentToolInput.length}`);
          try {
            const input = JSON.parse(currentToolInput || "{}");
            const result = processToolCall(currentToolName, input);
            if (result) {
              console.log(`Tool result: type=${result.type}, path=${result.path ?? "none"}, content length=${result.content?.length ?? 0}`);
              wsSend(ws, {
                type: result.type,
                path: result.path,
                content: result.content,
              });
              if (onToolCall) {
                await onToolCall(result);
              }
            } else {
              console.log(`processToolCall returned null for tool: ${currentToolName}`);
            }
          } catch (err) {
            console.error(`Failed to parse/process tool "${currentToolName}":`, err);
            console.error("Tool input (first 200 chars):", currentToolInput.slice(0, 200));
          }
          currentToolName = "";
          currentToolInput = "";
        }
        break;
      }
    }
  }

  } catch (streamErr) {
    console.error("Error during stream iteration:", streamErr);
    wsSend(ws, { type: "error", content: `Stream error: ${(streamErr as Error).message}` });
  }

  console.log(`Stream complete after ${eventCount} events, sending generation_complete`);
  wsSend(ws, { type: "generation_complete" });
}
