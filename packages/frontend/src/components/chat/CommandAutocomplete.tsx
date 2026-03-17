import { useState, useEffect, useCallback } from "react";

const COMMANDS = [
  { command: "/plan", description: "Start planning phase" },
  { command: "/design", description: "Start design phase" },
  { command: "/build", description: "Generate code" },
  { command: "/explain", description: "Explain code or concepts" },
  { command: "/review", description: "Review current code" },
  { command: "/help", description: "Show available commands" },
  { command: "/add-wallet", description: "Add wallet integration" },
  { command: "/add-screen", description: "Add a new screen" },
  { command: "/add-vault", description: "Add vault integration" },
  { command: "/add-storage", description: "Add async storage" },
  { command: "/add-navigation", description: "Add navigation" },
  { command: "/style-guide", description: "Apply style guide" },
  { command: "/add-form", description: "Add a form" },
  { command: "/add-list", description: "Add a list/grid" },
];

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

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-10 max-h-60 overflow-y-auto">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.command}
          type="button"
          className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
            i === selectedIndex ? "bg-slate-700" : "hover:bg-slate-750"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd.command);
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="text-blue-400 font-mono">{cmd.command}</span>
          <span className="text-slate-400">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}
