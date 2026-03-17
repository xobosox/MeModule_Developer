import type Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage } from "../lib/types.js";

const MAX_MESSAGES = 20;

export function buildMessageHistory(
  messages: ConversationMessage[]
): Anthropic.MessageParam[] {
  // Future enhancement: summarize evicted messages per spec section 6.4
  const recent = messages.slice(-MAX_MESSAGES);

  return recent.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
