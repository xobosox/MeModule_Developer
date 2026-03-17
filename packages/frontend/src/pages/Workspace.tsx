import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "../store/project-store";
import { useChatStore } from "../store/chat-store";
import { useWorkspaceStore } from "../store/workspace-store";
import { WsClient } from "../lib/ws-client";
import type { WsMessage } from "../lib/types";
import ChatPanel from "../components/chat/ChatPanel";
import TabBar from "../components/tabs/TabBar";
import PlanTab from "../components/tabs/PlanTab";
import DesignTab from "../components/tabs/DesignTab";
import CodeTab from "../components/tabs/CodeTab";
import PreviewTab from "../components/tabs/PreviewTab";
import PhaseIndicator from "../components/workspace/PhaseIndicator";
import ThemeToggle from "../components/workspace/ThemeToggle";

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const wsRef = useRef<WsClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { currentProject, loadProject, updateFile } = useProjectStore();
  const { addUserMessage, startStreaming, appendStreamContent, finalizeStream, setError, clearMessages } =
    useChatStore();
  const { activeTab, setActiveTab, planContent, setPlanContent, designContent, setDesignContent, phase, activeAgent, setPhase, setActiveAgent, reset } =
    useWorkspaceStore();

  useEffect(() => {
    if (!id) return;

    loadProject(id);
    reset();
    clearMessages();

    const client = new WsClient(id);
    wsRef.current = client;

    const handleMessage = (msg: WsMessage) => {
      switch (msg.type) {
        case "connected":
          setIsConnected(true);
          break;
        case "chat":
          if (msg.content) {
            appendStreamContent(msg.content);
          }
          break;
        case "file":
          if (msg.path && msg.content !== undefined) {
            updateFile(msg.path, msg.content);
          }
          break;
        case "preview":
          if (msg.content) {
            setDesignContent(msg.content);
          }
          break;
        case "plan":
          if (msg.content) {
            setPlanContent(msg.content);
          }
          break;
        case "generation_complete":
          finalizeStream();
          break;
        case "error":
          setError(msg.message || "An error occurred");
          break;
        case "phase_changed":
          if (msg.phase) setPhase(msg.phase as any);
          setActiveAgent(msg.agent ?? null);
          break;
        case "review_started":
          appendStreamContent("\n_Reviewing..._\n");
          break;
        case "review_complete":
          if (msg.passed === false && msg.issues && msg.issues.length > 0) {
            appendStreamContent(
              "\n**Review issues found:**\n" +
                msg.issues.map((issue) => `- ${issue}`).join("\n") +
                "\n",
            );
          }
          finalizeStream();
          break;
      }
    };

    const unsub = client.onMessage(handleMessage);
    client.connect().catch(() => {
      setError("Failed to connect to server");
    });

    return () => {
      unsub();
      client.disconnect();
      wsRef.current = null;
      setIsConnected(false);
    };
  }, [id]);

  const handleSend = (content: string) => {
    addUserMessage(content);
    startStreaming();
    wsRef.current?.sendMessage(content);
  };

  const projectName = currentProject?.name || "Loading...";

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-3"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{
            color: "var(--text-secondary)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
          aria-label="Back to dashboard"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          className="w-px h-5"
          style={{ background: "var(--border)" }}
        />

        <span
          className="text-sm font-semibold truncate max-w-[200px]"
          style={{ color: "var(--text-primary)" }}
          title={projectName}
        >
          {projectName}
        </span>

        <PhaseIndicator phase={phase} activeAgent={activeAgent} />

        {/* Right side: theme toggle, connection status, export */}
        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />

          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isConnected ? "var(--success)" : "var(--error)",
              boxShadow: isConnected
                ? "0 0 6px rgba(16, 185, 129, 0.4)"
                : "0 0 6px rgba(239, 68, 68, 0.4)",
            }}
            title={isConnected ? "Connected" : "Disconnected"}
          />

          <button
            className="btn-secondary"
            style={{
              padding: "6px 14px",
              fontSize: "12px",
            }}
            onClick={() => {
              // Export functionality placeholder
            }}
          >
            Export
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel -- Chat */}
        <div
          className="flex flex-col"
          style={{
            width: "35%",
            borderRight: "1px solid var(--border)",
          }}
        >
          <ChatPanel onSend={handleSend} isConnected={isConnected} />
        </div>

        {/* Right panel -- Tabs */}
        <div className="flex flex-col" style={{ width: "65%" }}>
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 overflow-hidden">
            {activeTab === "plan" && <PlanTab content={planContent} />}
            {activeTab === "design" && <DesignTab content={designContent} />}
            {activeTab === "code" && (
              <CodeTab onFileEdit={(path, content) => wsRef.current?.sendFileEdit(path, content)} />
            )}
            {activeTab === "preview" && (
              <PreviewTab onFixWithAi={(error) => {
                handleSend(`Fix this error in the preview:\n\n${error}`);
              }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
