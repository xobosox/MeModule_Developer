interface ErrorOverlayProps {
  error: string;
  onFixWithAi: (error: string) => void;
}

export default function ErrorOverlay({ error, onFixWithAi }: ErrorOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col p-6 overflow-auto"
      style={{
        background: "var(--overlay-bg)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="p-5 flex flex-col flex-1"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "12px",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--error)" }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--error)" }}
          >
            Runtime Error
          </h3>
        </div>

        <pre
          className="flex-1 text-xs whitespace-pre-wrap break-words font-mono leading-relaxed overflow-auto rounded-lg p-4"
          style={{
            color: "var(--text-primary)",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
          }}
        >
          {error}
        </pre>

        <button
          onClick={() => onFixWithAi(error)}
          className="btn-primary mt-4 self-start flex items-center gap-2"
          style={{ padding: "8px 16px", fontSize: "13px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Fix with AI
        </button>
      </div>
    </div>
  );
}
