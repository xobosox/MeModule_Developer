import { useState } from "react";
import type { ChatMessage as ChatMessageType } from "../../lib/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [showTimestamp, setShowTimestamp] = useState(false);

  return (
    <div
      className="px-5 py-3 chat-message-enter"
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      <div
        style={{
          maxWidth: "85%",
          position: "relative",
        }}
      >
        <div
          className="text-sm whitespace-pre-wrap"
          style={{
            background: isUser ? "var(--accent-subtle)" : "transparent",
            border: isUser ? "1px solid rgba(6, 182, 212, 0.15)" : "none",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            padding: isUser ? "10px 16px" : "4px 0",
            color: "var(--text-primary)",
            lineHeight: "1.6",
          }}
        >
          {message.content}
        </div>

        {/* Timestamp on hover */}
        <div
          className="transition-opacity duration-200 mt-1"
          style={{
            opacity: showTimestamp ? 1 : 0,
            fontSize: "11px",
            color: "var(--text-muted)",
            textAlign: isUser ? "right" : "left",
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
