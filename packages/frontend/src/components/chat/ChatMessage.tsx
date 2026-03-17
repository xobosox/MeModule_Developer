import type { ChatMessage as ChatMessageType } from "../../lib/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`px-4 py-3 ${isUser ? "bg-slate-800" : "bg-slate-850"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-xs font-semibold ${isUser ? "text-blue-400" : "text-emerald-400"}`}
        >
          {isUser ? "You" : "Assistant"}
        </span>
        <span className="text-xs text-slate-500">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-sm text-slate-200 whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  );
}
