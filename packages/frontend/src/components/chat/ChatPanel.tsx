import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../../store/chat-store";
import { useWorkspaceStore } from "../../store/workspace-store";
import ChatMessage from "./ChatMessage";
import CommandAutocomplete from "./CommandAutocomplete";

interface ChatPanelProps {
  onSend: (content: string) => void;
  isConnected: boolean;
}

const SUGGESTIONS = [
  "Build a loyalty card module",
  "Create a payment screen",
  "Make an event check-in app",
  "I have an idea...",
];

const PHASE_LABELS: Record<string, string> = {
  planning: "Planning",
  designing: "Designing",
  generating: "Building",
  iterating: "Iterating",
};

export default function ChatPanel({ onSend, isConnected }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, streamingContent, isStreaming, error } = useChatStore();
  const phase = useWorkspaceStore((s) => s.phase);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
      const scrollH = inputRef.current.scrollHeight;
      inputRef.current.style.height = Math.min(scrollH, 120) + "px";
    }
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    setShowCommands(value.startsWith("/"));
  };

  const handleCommandSelect = (command: string) => {
    setInput(command + " ");
    setShowCommands(false);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (showCommands) return;
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
    setShowCommands(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSend(suggestion);
  };

  const hasMessages = messages.length > 0 || isStreaming;
  const phaseLabel = PHASE_LABELS[phase] || "Planning";

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Welcome state */
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="flex flex-col items-center gap-4 max-w-sm text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--border)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>

              <div>
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  Let's build your MeModule
                </h2>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Describe what you want to build, and I'll guide you through planning, designing, and generating your module.
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    disabled={!isConnected}
                    className="text-left text-sm px-4 py-3 transition-all duration-200"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "4px",
                      color: "var(--text-primary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.background = "var(--accent-subtle)";
                      e.currentTarget.style.color = "var(--accent-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "var(--bg-surface)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="py-2">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Streaming content */}
            {isStreaming && streamingContent && (
              <div
                className="px-5 py-4 chat-message-enter"
                style={{ maxWidth: "85%" }}
              >
                <div
                  className="text-sm chat-markdown"
                  style={{
                    color: "var(--text-primary)",
                    lineHeight: "1.7",
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }}
                />
                <span className="streaming-dots" />
              </div>
            )}

            {/* Thinking indicator */}
            {isStreaming && !streamingContent && (
              <div className="px-5 py-4 chat-message-enter">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Thinking
                  </span>
                  <span className="streaming-dots" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="px-5 py-3">
                <div
                  className="text-sm px-4 py-3"
                  style={{
                    color: "var(--error)",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "4px",
                  }}
                >
                  {error}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area -- terminal-inspired */}
      <form
        onSubmit={handleSubmit}
        className="relative p-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <CommandAutocomplete
          input={input}
          onSelect={handleCommandSelect}
          visible={showCommands}
          onDismiss={() => setShowCommands(false)}
        />
        <div className="chat-terminal-input flex items-end gap-2"
          style={{ padding: "6px 6px 6px 0" }}
        >
          {/* Phase prompt */}
          <div className="phase-prompt flex items-center pl-3 pb-2.5 pt-2.5">
            <span>[{phaseLabel}]</span>
            <span className="ml-1" style={{ color: "var(--text-muted)" }}>&gt;</span>
          </div>

          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowCommands(false), 150)}
            placeholder="Type a message or /command..."
            disabled={!isConnected || isStreaming}
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none disabled:opacity-50 font-mono"
            style={{
              color: "var(--text-primary)",
              height: "44px",
              lineHeight: "1.6",
              paddingTop: "10px",
              paddingBottom: "10px",
            }}
          />
          <button
            type="submit"
            disabled={!isConnected || isStreaming || !input.trim()}
            className="flex items-center justify-center w-9 h-9 transition-all duration-200 disabled:opacity-30"
            style={{
              background: input.trim() ? "var(--accent)" : "var(--bg-surface-hover)",
              color: input.trim() ? "#ffffff" : "var(--text-muted)",
              flexShrink: 0,
              borderRadius: "4px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

/** Minimal markdown renderer for chat messages */
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
