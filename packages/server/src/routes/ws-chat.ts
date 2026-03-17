import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type postgres from "postgres";
import { consumeTicket } from "../auth/ws-ticket.js";
import {
  getProject,
  getConversationByProjectId,
  createConversation,
  appendMessage,
  updateFile,
  getTemplate,
} from "../db/queries.js";
import { buildSystemPrompt } from "../ai/system-prompt.js";
import { buildMessageHistory } from "../ai/context-manager.js";
import { streamAiResponse, type ToolCallOutput } from "../ai/stream-processor.js";
import type { ConversationMessage, ToolCallResult } from "../lib/types.js";

function wsSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function setupWebSocket(server: Server, sql: postgres.Sql): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/ws\/projects\/([^/]+)\/chat$/);

    if (!match) {
      socket.destroy();
      return;
    }

    const projectId = match[1];
    const ticket = url.searchParams.get("ticket");

    if (!ticket) {
      socket.destroy();
      return;
    }

    const ticketData = consumeTicket(ticket);
    if (!ticketData || ticketData.projectId !== projectId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, ticketData);
    });
  });

  wss.on(
    "connection",
    (ws: WebSocket, _req: unknown, auth: { userId: string; projectId: string }) => {
      let isGenerating = false;
      let abortController: AbortController | null = null;

      wsSend(ws, { type: "connected", projectId: auth.projectId });

      ws.on("message", async (raw: Buffer) => {
        let msg: { type: string; content?: string; path?: string };
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          wsSend(ws, { type: "error", content: "Invalid JSON" });
          return;
        }

        switch (msg.type) {
          case "user_message": {
            if (isGenerating) {
              wsSend(ws, {
                type: "error",
                content: "A generation is already in progress",
              });
              return;
            }

            if (!msg.content) {
              wsSend(ws, { type: "error", content: "Message content is required" });
              return;
            }

            isGenerating = true;
            abortController = new AbortController();

            try {
              const project = await getProject(sql, auth.projectId);
              if (!project) {
                wsSend(ws, { type: "error", content: "Project not found" });
                isGenerating = false;
                return;
              }

              let conversation = await getConversationByProjectId(
                sql,
                auth.projectId
              );
              if (!conversation) {
                conversation = await createConversation(sql, auth.projectId);
              }

              // Save user message
              const userMsg: ConversationMessage = {
                role: "user",
                content: msg.content,
                timestamp: new Date().toISOString(),
              };
              await appendMessage(sql, conversation.id, userMsg);

              // Build prompt context
              let templateName: string | undefined;
              let templateFileTree: Record<string, string> | undefined;
              if (project.template_id) {
                const template = await getTemplate(sql, project.template_id);
                if (template) {
                  templateName = template.name;
                  templateFileTree = template.file_tree;
                }
              }

              const systemPrompt = buildSystemPrompt({
                templateName,
                templateFileTree,
                fileTree: project.file_tree,
              });

              // Build message history (re-fetch to include the new user message)
              const updatedConversation = await getConversationByProjectId(
                sql,
                auth.projectId
              );
              const rawMessages = updatedConversation?.messages ?? [userMsg];
              const messageHistory = buildMessageHistory(rawMessages);

              if (messageHistory.length === 0) {
                // Fallback: if all messages were filtered out, use the user message directly
                messageHistory.push({ role: "user", content: msg.content! });
              }

              console.log("Sending to Claude:", JSON.stringify(messageHistory.map(m => ({ role: m.role, contentLen: typeof m.content === 'string' ? m.content.length : 'non-string' }))));

              const toolCalls: ToolCallResult[] = [];
              let chatContent = "";

              await streamAiResponse({
                ws,
                systemPrompt,
                messages: messageHistory,
                abortSignal: abortController.signal,
                onChatMessage: (content) => {
                  chatContent = content;
                },
                onToolCall: async (result: ToolCallOutput) => {
                  toolCalls.push({
                    type: result.type,
                    path: result.path,
                    content: result.content,
                  });

                  // Side effect: write file to DB
                  if (result.type === "file" && result.path) {
                    await updateFile(sql, auth.projectId, result.path, result.content);
                  }
                },
              });

              // Save assistant message
              const assistantMsg: ConversationMessage = {
                role: "assistant",
                content: chatContent,
                timestamp: new Date().toISOString(),
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              };
              await appendMessage(sql, conversation.id, assistantMsg);
            } catch (err) {
              if ((err as Error).name !== "AbortError") {
                console.error("AI stream error:", err);
                wsSend(ws, { type: "error", content: "AI generation failed" });
              }
            } finally {
              isGenerating = false;
              abortController = null;
            }
            break;
          }

          case "cancel": {
            if (abortController) {
              abortController.abort();
              wsSend(ws, { type: "generation_cancelled" });
            }
            break;
          }

          case "file_edited": {
            if (msg.path && msg.content !== undefined) {
              await updateFile(sql, auth.projectId, msg.path, msg.content);
            }
            break;
          }

          case "resume": {
            // Future enhancement: server-side buffer needed for production
            // to replay missed messages after reconnection
            wsSend(ws, { type: "resume_ack" });
            break;
          }

          default: {
            wsSend(ws, { type: "error", content: `Unknown message type: ${msg.type}` });
          }
        }
      });

      ws.on("close", () => {
        if (abortController) {
          abortController.abort();
        }
      });
    }
  );
}
