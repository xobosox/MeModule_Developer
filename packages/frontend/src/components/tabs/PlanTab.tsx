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

  const styledContent = `
    <!DOCTYPE html>
    <html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body {
        font-family: 'Inter', system-ui, sans-serif;
        background: #0d0d1a;
        color: #e4e4e7;
        padding: 24px;
        line-height: 1.7;
      }
      h1, h2, h3 { color: #ffffff; margin-top: 24px; margin-bottom: 12px; }
      h1 { font-size: 24px; font-weight: 700; }
      h2 { font-size: 20px; font-weight: 600; }
      h3 { font-size: 16px; font-weight: 600; }
      p { margin-bottom: 12px; }
      ul, ol { margin-bottom: 12px; padding-left: 20px; }
      li { margin-bottom: 4px; }
      code { background: #1a1a40; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
      pre { background: #1a1a40; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #2a2a42; }
      th { color: #a1a1b5; font-weight: 600; font-size: 13px; }
      a { color: #4f6fff; }
      strong { color: #ffffff; }
      hr { border: none; border-top: 1px solid #2a2a42; margin: 24px 0; }
    </style>
    </head><body>${content}</body></html>
  `;

  return (
    <div className="h-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <iframe
        srcDoc={styledContent}
        sandbox="allow-scripts"
        className="w-full h-full border-0"
        title="Module Plan"
      />
    </div>
  );
}
