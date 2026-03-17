import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../../store/chat-store";
import ChatMessage from "./ChatMessage";
import CommandAutocomplete from "./CommandAutocomplete";

interface ChatPanelProps {
  onSend: (content: string) => void;
  isConnected: boolean;
}

export default function ChatPanel({ onSend, isConnected }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, streamingContent, isStreaming, error } = useChatStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setShowCommands(value.startsWith("/"));
  };

  const handleCommandSelect = (command: string) => {
    setInput(command + " ");
    setShowCommands(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showCommands) return;
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
    setShowCommands(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700">
        <div
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"}`}
        />
        <span className="text-xs text-slate-400">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingContent && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-emerald-400">
                Assistant
              </span>
            </div>
            <div className="text-sm text-slate-200 whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="px-4 py-3">
            <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse" />
          </div>
        )}

        {error && (
          <div className="px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative border-t border-slate-700 p-3 flex gap-2"
      >
        <CommandAutocomplete
          input={input}
          onSelect={handleCommandSelect}
          visible={showCommands}
          onDismiss={() => setShowCommands(false)}
        />
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onBlur={() => setTimeout(() => setShowCommands(false), 150)}
          placeholder="Describe your module..."
          disabled={!isConnected || isStreaming}
          className="flex-1 bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isConnected || isStreaming || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm px-4 py-2 rounded transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
