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
  updateProjectPhase,
  updatePlanContent,
  updateDesignContent,
} from "../db/queries.js";
import { buildSystemPrompt } from "../ai/system-prompt.js";
import { buildMessageHistory } from "../ai/context-manager.js";
import { streamAiResponse, type ToolCallOutput } from "../ai/stream-processor.js";
import {
  parseCommand,
  classifyIntent,
  resolveCommand,
  buildAgentSystemPrompt,
  runReviewLoop,
} from "../ai/orchestrator.js";
import { getAgent, filterTools } from "../ai/agents/index.js";
import { loadSkills } from "../ai/skills/domain/loader.js";
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
              let project = await getProject(sql, auth.projectId);
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

              // 1. Parse commands
              const { command, remainingMessage } = parseCommand(msg.content);

              // 2. Load skills
              const allSkills = await loadSkills(sql);

              // 3. Route
              let routing;
              if (command) {
                routing = resolveCommand(command, project.phase, allSkills);
                if (!routing) {
                  wsSend(ws, { type: "error", content: `Unknown command: /${command}` });
                  isGenerating = false;
                  return;
                }
              } else {
                routing = await classifyIntent({
                  message: remainingMessage,
                  phase: project.phase,
                  allSkills,
                });
              }

              // 4. Phase transition
              if (routing.phaseTransition && routing.phaseTransition !== project.phase) {
                await updateProjectPhase(sql, auth.projectId, routing.phaseTransition as typeof project.phase);
                project = { ...project, phase: routing.phaseTransition as typeof project.phase };
                wsSend(ws, { type: "phase_changed", phase: routing.phaseTransition, agent: routing.agent });
              }

              console.log(`Routing: agent=${routing.agent}, phase=${project.phase}, transition=${routing.phaseTransition ?? "none"}, skills=${routing.skills.join(",") || "none"}`);

              // 5. Build agent prompt
              const agent = getAgent(routing.agent);
              let systemPrompt: string;
              let tools;

              if (agent) {
                systemPrompt = buildAgentSystemPrompt({
                  agent,
                  project,
                  matchedSkillNames: routing.skills,
                  allSkills,
                });
                // 6. Agent-filtered tools
                tools = filterTools(agent.tools);
              } else {
                // Fallback to legacy prompt if agent not found
                let templateName: string | undefined;
                let templateFileTree: Record<string, string> | undefined;
                if (project.template_id) {
                  const template = await getTemplate(sql, project.template_id);
                  if (template) {
                    templateName = template.name;
                    templateFileTree = template.file_tree;
                  }
                }
                systemPrompt = buildSystemPrompt({
                  templateName,
                  templateFileTree,
                  fileTree: project.file_tree,
                });
                tools = undefined;
              }

              // Build message history with context budget tracking
              const updatedConversation = await getConversationByProjectId(
                sql,
                auth.projectId
              );
              const rawMessages = updatedConversation?.messages ?? [userMsg];
              const { messages: messageHistory, budget } = await buildMessageHistory(
                rawMessages,
                systemPrompt.length
              );

              console.log(
                `Context: ${budget.originalMessageCount} msgs → ${budget.finalMessageCount} (${budget.budgetUsedPercent}% of budget, ${budget.wasSummarized ? "summarized" : "full"})`
              );

              const toolCalls: ToolCallResult[] = [];
              let chatContent = "";
              const chatParts: string[] = [];

              await streamAiResponse({
                ws,
                systemPrompt,
                messages: messageHistory,
                abortSignal: abortController.signal,
                tools,
                onChatMessage: (content) => {
                  // Text content blocks (raw text outside tool calls)
                  chatParts.push(content);
                },
                onToolCall: async (result: ToolCallOutput) => {
                  toolCalls.push({
                    type: result.type,
                    path: result.path,
                    content: result.content,
                  });

                  // Capture chat tool call content for conversation history
                  if (result.type === "chat") {
                    chatParts.push(result.content);
                  }

                  // Side effects: persist tool outputs
                  if (result.type === "file" && result.path) {
                    await updateFile(sql, auth.projectId, result.path, result.content);
                  } else if (result.type === "plan") {
                    await updatePlanContent(sql, auth.projectId, result.content);
                  } else if (result.type === "preview") {
                    await updateDesignContent(sql, auth.projectId, result.content);
                  }
                },
              });

              // Combine all chat content (from both text blocks and chat tool calls)
              chatContent = chatParts.join("\n\n");

              // Save assistant message
              const assistantMsg: ConversationMessage = {
                role: "assistant",
                content: chatContent || "[AI responded with tool calls only]",
                timestamp: new Date().toISOString(),
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              };
              await appendMessage(sql, conversation.id, assistantMsg);

              // 7. Auto-review after generation
              if (routing.agent === "generator" && toolCalls.some(t => t.type === "file")) {
                await runReviewLoop({
                  projectId: auth.projectId,
                  ws,
                  sql,
                  abortSignal: abortController.signal,
                });
              }
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
            const project = await getProject(sql, auth.projectId);
            if (project && project.phase !== "iterating") {
              await updateProjectPhase(sql, auth.projectId, "iterating");
              wsSend(ws, { type: "phase_changed", phase: "iterating", agent: "iterator" });
            }
            if (msg.path && msg.content !== undefined) {
              await updateFile(sql, auth.projectId, msg.path, msg.content);
            }
            break;
          }

          case "resume": {
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
