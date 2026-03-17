const PHASES = [
  { key: "planning", label: "Plan" },
  { key: "designing", label: "Design" },
  { key: "generating", label: "Build" },
  { key: "iterating", label: "Iterate" },
] as const;

interface PhaseIndicatorProps {
  phase: string;
  activeAgent: string | null;
}

export default function PhaseIndicator({ phase, activeAgent }: PhaseIndicatorProps) {
  const currentIndex = PHASES.findIndex((p) => p.key === phase);

  return (
    <div className="flex items-center gap-1.5 ml-2">
      {PHASES.map((p, i) => {
        const isCurrent = i === currentIndex;
        const isCompleted = i < currentIndex;

        let bg = "transparent";
        let border = "1px solid var(--border)";
        let color = "var(--text-muted)";
        let shadow = "none";

        if (isCurrent) {
          bg = "var(--accent-subtle)";
          border = "1px solid var(--accent)";
          color = "var(--accent)";
          shadow = "0 0 12px var(--accent-glow)";
        } else if (isCompleted) {
          bg = "var(--bg-surface-active)";
          border = "1px solid var(--border-hover)";
          color = "var(--text-secondary)";
        }

        return (
          <div key={p.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <div
                className="w-3 h-px"
                style={{
                  background: isCompleted || isCurrent ? "var(--border-hover)" : "var(--border)",
                }}
              />
            )}
            <div
              className="px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5"
              style={{
                background: bg,
                border,
                color,
                boxShadow: shadow,
              }}
              title={isCurrent && activeAgent ? `Agent: ${activeAgent}` : undefined}
            >
              {p.label}
              {isCurrent && activeAgent && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
