interface ErrorOverlayProps {
  error: string;
  onFixWithAi: (error: string) => void;
}

export default function ErrorOverlay({ error, onFixWithAi }: ErrorOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 p-6 overflow-auto">
      <h3 className="text-sm font-semibold text-red-400 mb-3">Runtime Error</h3>
      <pre className="flex-1 text-xs text-red-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
        {error}
      </pre>
      <button
        onClick={() => onFixWithAi(error)}
        className="mt-4 self-start px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
      >
        Fix with AI
      </button>
    </div>
  );
}
