import Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage } from "../lib/types.js";

// ── Token estimation ─────────────────────────────────────────────────────────
// Rough estimate: ~4 chars per token for English text/code
const CHARS_PER_TOKEN = 4;

// Claude Sonnet 4.6 context window
const MODEL_CONTEXT_LIMIT = 200_000;

// Reserve tokens for: max_tokens response (8192) + tool definitions (~2000) + safety margin
const RESERVED_TOKENS = 12_000;

// Target: keep total input under this limit
const INPUT_TOKEN_BUDGET = MODEL_CONTEXT_LIMIT - RESERVED_TOKENS; // ~188,000

// When we're over budget, summarize older messages
const SUMMARIZE_THRESHOLD = 0.75; // Start summarizing at 75% of budget (~141,000 tokens)

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ── Project context builder ──────────────────────────────────────────────────

export interface ProjectContext {
  fileTree: Record<string, string>;
  planContent?: string | null;
  designContent?: string | null;
}

export function buildProjectContext(context: ProjectContext): string {
  const parts: string[] = [];
  if (context.planContent) {
    parts.push(`## Approved Plan\n${context.planContent}`);
  }
  if (context.designContent) {
    parts.push(`## Approved Design\n${context.designContent}`);
  }
  if (Object.keys(context.fileTree).length > 0) {
    parts.push("## Current Project Files");
    for (const [path, content] of Object.entries(context.fileTree)) {
      parts.push(`### ${path}\n\`\`\`\n${content}\n\`\`\``);
    }
  }
  return parts.join("\n\n");
}

// ── Context budget tracking ──────────────────────────────────────────────────

export interface ContextBudget {
  systemPromptTokens: number;
  messageTokens: number;
  totalTokens: number;
  budgetLimit: number;
  budgetUsedPercent: number;
  wasSummarized: boolean;
  originalMessageCount: number;
  finalMessageCount: number;
}

// ── Message history builder with auto-compaction ─────────────────────────────

export async function buildMessageHistory(
  messages: ConversationMessage[],
  systemPromptLength: number
): Promise<{ messages: Anthropic.MessageParam[]; budget: ContextBudget }> {
  // Filter and validate messages
  const validMessages = messages.filter(
    (msg) =>
      (msg.role === "user" || msg.role === "assistant") &&
      typeof msg.content === "string" &&
      msg.content.length > 0
  );

  const systemTokens = estimateTokens(systemPromptLength.toString().length > 0 ? "x".repeat(systemPromptLength) : "");
  const actualSystemTokens = Math.ceil(systemPromptLength / CHARS_PER_TOKEN);

  // Calculate total tokens for all messages
  const allMessageTokens = validMessages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  const totalEstimate = actualSystemTokens + allMessageTokens;

  // Check if we need to compact
  const threshold = INPUT_TOKEN_BUDGET * SUMMARIZE_THRESHOLD;
  let wasSummarized = false;
  let finalMessages: Anthropic.MessageParam[];

  if (totalEstimate > threshold && validMessages.length > 6) {
    // We need to compact — summarize older messages
    const { summarized, recentMessages } = await compactMessages(
      validMessages,
      actualSystemTokens
    );
    finalMessages = summarized;
    wasSummarized = true;

    console.log(
      `Context compacted: ${validMessages.length} messages → summary + ${recentMessages} recent (${Math.round((totalEstimate / INPUT_TOKEN_BUDGET) * 100)}% budget used before compaction)`
    );
  } else {
    // No compaction needed — use all valid messages
    finalMessages = validMessages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
  }

  // Ensure we always have at least one message
  if (finalMessages.length === 0) {
    finalMessages = [{ role: "user", content: "(no previous context)" }];
  }

  // Ensure messages alternate correctly (Claude requires user/assistant alternation)
  finalMessages = ensureAlternation(finalMessages);

  const finalTokens = finalMessages.reduce(
    (sum, msg) => sum + estimateTokens(typeof msg.content === "string" ? msg.content : ""),
    0
  );

  return {
    messages: finalMessages,
    budget: {
      systemPromptTokens: actualSystemTokens,
      messageTokens: finalTokens,
      totalTokens: actualSystemTokens + finalTokens,
      budgetLimit: INPUT_TOKEN_BUDGET,
      budgetUsedPercent: Math.round(((actualSystemTokens + finalTokens) / INPUT_TOKEN_BUDGET) * 100),
      wasSummarized,
      originalMessageCount: validMessages.length,
      finalMessageCount: finalMessages.length,
    },
  };
}

// ── Compaction via summarization ─────────────────────────────────────────────

async function compactMessages(
  messages: ConversationMessage[],
  systemTokenEstimate: number
): Promise<{ summarized: Anthropic.MessageParam[]; recentMessages: number }> {
  // Keep the most recent messages that fit in ~40% of remaining budget
  const messagesBudget = INPUT_TOKEN_BUDGET - systemTokenEstimate;
  const recentBudget = messagesBudget * 0.4;
  const summaryBudget = messagesBudget * 0.15; // 15% for the summary itself

  // Walk backwards to find how many recent messages fit
  let recentTokens = 0;
  let recentCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    if (recentTokens + msgTokens > recentBudget && recentCount >= 4) {
      break;
    }
    recentTokens += msgTokens;
    recentCount++;
  }

  // At minimum keep last 4 messages, at most keep all but 4
  recentCount = Math.max(4, Math.min(recentCount, messages.length - 2));

  const olderMessages = messages.slice(0, messages.length - recentCount);
  const recentMessages = messages.slice(messages.length - recentCount);

  // Summarize older messages
  let summary: string;
  try {
    summary = await generateSummary(olderMessages, summaryBudget);
  } catch (err) {
    console.error("Failed to generate summary, using truncation fallback:", err);
    // Fallback: take first and last few of the older messages
    const kept = olderMessages.slice(0, 2).concat(olderMessages.slice(-2));
    summary = `[Conversation summary — ${olderMessages.length} earlier messages condensed]\n\n` +
      kept.map((m) => `${m.role}: ${m.content.slice(0, 200)}...`).join("\n\n");
  }

  // Build the compacted message list
  const result: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `[Previous conversation summary]\n${summary}\n\n[The conversation continues below with the most recent messages]`,
    },
    {
      role: "assistant",
      content: "I understand the context from our previous conversation. Let me continue helping you.",
    },
    ...recentMessages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  return { summarized: result, recentMessages: recentCount };
}

async function generateSummary(
  messages: ConversationMessage[],
  tokenBudget: number
): Promise<string> {
  const maxSummaryChars = tokenBudget * CHARS_PER_TOKEN;

  // Build a condensed version of the conversation for summarization
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  // If the conversation is short enough, just use it directly
  if (conversationText.length < maxSummaryChars) {
    return conversationText;
  }

  // Use Claude Haiku to generate a summary (fast and cheap)
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: Math.min(2048, Math.floor(tokenBudget)),
    messages: [
      {
        role: "user",
        content: `Summarize this conversation between a user and an AI assistant building a ShareRing MeModule. Preserve:
- What the user wants to build (the module concept)
- Key decisions made (features, design choices, technical decisions)
- Current state of the project (what's been planned, designed, or built)
- Any open questions or next steps discussed

Be concise but preserve all important context. This summary will replace the older messages in the conversation.

Conversation:
${conversationText.slice(0, 50000)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : conversationText.slice(0, maxSummaryChars);
}

// ── Message alternation enforcement ──────────────────────────────────────────
// Claude requires strict user/assistant alternation

function ensureAlternation(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (messages.length === 0) return messages;

  const result: Anthropic.MessageParam[] = [];
  let lastRole: string | null = null;

  for (const msg of messages) {
    if (msg.role === lastRole) {
      // Same role twice — merge content if both are same role
      const prev = result[result.length - 1];
      if (prev) {
        prev.content = `${prev.content}\n\n${msg.content}`;
      }
    } else {
      result.push({ ...msg });
      lastRole = msg.role;
    }
  }

  // Claude requires messages to start with "user"
  if (result.length > 0 && result[0].role !== "user") {
    result.unshift({
      role: "user",
      content: "(continuing our conversation)",
    });
  }

  return result;
}
