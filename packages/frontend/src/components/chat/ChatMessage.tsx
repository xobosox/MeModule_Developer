import { useState } from "react";
import type { ChatMessage as ChatMessageType } from "../../lib/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

/** Minimal markdown renderer for AI messages */
function renderMarkdown(text: string): string {
  // Escape HTML
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`...`)
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Bold (**...**)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic (_..._)
  html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "<em>$1</em>");

  // Unordered list items (- ...)
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");

  // Single newlines to <br> (but not inside pre)
  html = html.replace(/(?<!<\/li>)\n(?!<)/g, "<br>");

  return html;
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
        {isUser ? (
          <div
            className="text-sm whitespace-pre-wrap"
            style={{
              background: "var(--accent-subtle)",
              border: "1px solid rgba(1, 14, 208, 0.2)",
              borderRadius: "12px 12px 4px 12px",
              padding: "10px 16px",
              color: "var(--text-primary)",
              lineHeight: "1.6",
            }}
          >
            {message.content}
          </div>
        ) : (
          <div
            className="text-sm chat-markdown"
            style={{
              padding: "4px 0",
              color: "var(--text-primary)",
              lineHeight: "1.7",
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}

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
