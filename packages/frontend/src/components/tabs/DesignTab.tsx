interface DesignTabProps {
  content: string;
}

export default function DesignTab({ content }: DesignTabProps) {
  if (!content) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3"
        style={{ color: "var(--text-muted)" }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <p className="text-sm text-center max-w-xs">
          Screen designs will appear here once the Designer agent creates them.
          Approve your plan first, then designs will be generated automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto flex justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-[430px] py-4">
        <iframe
          srcDoc={content}
          sandbox="allow-scripts"
          className="w-full border-0"
          style={{
            minHeight: "100%",
            height: "2000px",
            background: "transparent",
          }}
          title="Design Mockups"
        />
      </div>
    </div>
  );
}
