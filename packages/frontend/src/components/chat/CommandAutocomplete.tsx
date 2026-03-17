import { useState, useEffect, useCallback } from "react";

interface CommandDef {
  command: string;
  description: string;
  icon: string;
  group: "Workflow" | "Actions" | "Help";
}

const COMMANDS: CommandDef[] = [
  // Workflow
  { command: "/plan", description: "Start planning phase", icon: "\uD83D\uDCCB", group: "Workflow" },
  { command: "/design", description: "Start design phase", icon: "\uD83C\uDFA8", group: "Workflow" },
  { command: "/build", description: "Generate code", icon: "\uD83D\uDD28", group: "Workflow" },
  // Actions
  { command: "/add-wallet", description: "Add wallet integration", icon: "\uD83D\uDCB3", group: "Actions" },
  { command: "/add-screen", description: "Add a new screen", icon: "\uD83D\uDCF1", group: "Actions" },
  { command: "/add-vault", description: "Add vault integration", icon: "\uD83D\uDD12", group: "Actions" },
  { command: "/add-storage", description: "Add async storage", icon: "\uD83D\uDCBE", group: "Actions" },
  { command: "/add-navigation", description: "Add navigation", icon: "\uD83E\uDDED", group: "Actions" },
  { command: "/add-form", description: "Add a form", icon: "\uD83D\uDCDD", group: "Actions" },
  { command: "/add-list", description: "Add a list/grid", icon: "\uD83D\uDCC3", group: "Actions" },
  { command: "/style-guide", description: "Apply style guide", icon: "\uD83C\uDFA8", group: "Actions" },
  // Help
  { command: "/review", description: "Review current code", icon: "\uD83D\uDD0D", group: "Help" },
  { command: "/explain", description: "Explain code or concepts", icon: "\uD83D\uDCA1", group: "Help" },
  { command: "/help", description: "Show available commands", icon: "\u2753", group: "Help" },
];

const GROUP_ORDER: CommandDef["group"][] = ["Workflow", "Actions", "Help"];

interface CommandAutocompleteProps {
  input: string;
  onSelect: (fullCommand: string) => void;
  visible: boolean;
  onDismiss: () => void;
}

export default function CommandAutocomplete({
  input,
  onSelect,
  visible,
  onDismiss,
}: CommandAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = COMMANDS.filter((c) =>
    c.command.toLowerCase().includes(input.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [input]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(filtered[selectedIndex].command);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    },
    [visible, filtered, selectedIndex, onSelect, onDismiss],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  // Group the filtered commands
  const grouped: Record<string, CommandDef[]> = {};
  for (const cmd of filtered) {
    if (!grouped[cmd.group]) grouped[cmd.group] = [];
    grouped[cmd.group].push(cmd);
  }

  let flatIndex = 0;

  return (
    <div
      className="absolute bottom-full left-3 right-3 mb-2 rounded-xl overflow-hidden z-10 max-h-72 overflow-y-auto"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.4)",
        animation: "commandSlideUp 0.15s ease-out",
      }}
    >
      {GROUP_ORDER.map((group) => {
        const cmds = grouped[group];
        if (!cmds || cmds.length === 0) return null;

        return (
          <div key={group}>
            <div
              className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {group}
            </div>
            {cmds.map((cmd) => {
              const thisIndex = flatIndex++;
              const isSelected = thisIndex === selectedIndex;
              return (
                <button
                  key={cmd.command}
                  type="button"
                  className="w-full text-left px-3 py-2.5 flex items-center gap-3 text-sm transition-colors"
                  style={{
                    background: isSelected ? "var(--bg-surface-active)" : "transparent",
                    color: "var(--text-primary)",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(cmd.command);
                  }}
                  onMouseEnter={() => setSelectedIndex(thisIndex)}
                >
                  <span className="text-base w-6 text-center flex-shrink-0">{cmd.icon}</span>
                  <span
                    className="font-mono text-xs"
                    style={{ color: "var(--accent-secondary)" }}
                  >
                    {cmd.command}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>{cmd.description}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
