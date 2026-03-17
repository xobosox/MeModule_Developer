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
import CodeTab from "../components/tabs/CodeTab";
import PreviewTab from "../components/tabs/PreviewTab";

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const wsRef = useRef<WsClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { currentProject, loadProject, updateFile } = useProjectStore();
  const { addUserMessage, startStreaming, appendStreamContent, finalizeStream, setError, clearMessages } =
    useChatStore();
  const { activeTab, setActiveTab, planContent, setPlanContent, setPreviewContent, reset } =
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
          if (msg.streaming && msg.content) {
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
            setPreviewContent(msg.content);
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

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <span className="text-sm font-medium">
          {currentProject?.name || "Loading..."}
        </span>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Chat */}
        <div className="w-[35%] border-r border-slate-800 flex flex-col">
          <ChatPanel onSend={handleSend} isConnected={isConnected} />
        </div>

        {/* Right panel — Tabs */}
        <div className="w-[65%] flex flex-col">
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 overflow-hidden">
            {activeTab === "plan" && <PlanTab content={planContent} />}
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
