interface PlanTabProps {
  content: string;
}

export default function PlanTab({ content }: PlanTabProps) {
  if (!content) {
    return (
      <div
        className="flex items-center justify-center h-full px-8"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
              <path d="M10 9H8" />
            </svg>
          </div>
          <div>
            <h3
              className="text-sm font-semibold mb-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              Module plan
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Your module plan will appear here once the AI creates it. Start by describing what you want to build in the chat.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-6 prose prose-invert prose-sm max-w-none overflow-y-auto h-full"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        lineHeight: "1.7",
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
