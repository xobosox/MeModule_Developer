const PHASES = ["planning", "designing", "generating", "iterating"] as const;

interface PhaseIndicatorProps {
  phase: string;
  activeAgent: string | null;
}

export default function PhaseIndicator({ phase, activeAgent }: PhaseIndicatorProps) {
  const currentIndex = PHASES.indexOf(phase as (typeof PHASES)[number]);

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((p, i) => {
        const isCurrent = i === currentIndex;
        const isCompleted = i < currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={p} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-6 border-t ${
                  isCompleted || isCurrent ? "border-slate-500" : "border-slate-700"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isCurrent
                    ? "bg-blue-400"
                    : isCompleted
                      ? "bg-slate-400"
                      : "border border-slate-600 bg-transparent"
                }`}
              />
              <span
                className={`text-[10px] leading-none whitespace-nowrap ${
                  isCurrent
                    ? "text-blue-400"
                    : isCompleted
                      ? "text-slate-400"
                      : "text-slate-600"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
              {isCurrent && activeAgent && (
                <span className="text-[9px] text-slate-500 whitespace-nowrap">
                  {activeAgent}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
