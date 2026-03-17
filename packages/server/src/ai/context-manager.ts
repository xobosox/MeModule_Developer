import type Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage } from "../lib/types.js";

const MAX_MESSAGES = 20;

export function buildMessageHistory(
  messages: ConversationMessage[]
): Anthropic.MessageParam[] {
  // Future enhancement: summarize evicted messages per spec section 6.4
  const recent = messages.slice(-MAX_MESSAGES);

  // Filter and validate messages — Claude requires role to be "user" or "assistant"
  // and content must be a non-empty string
  return recent
    .filter(
      (msg) =>
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string" &&
        msg.content.length > 0
    )
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
}
