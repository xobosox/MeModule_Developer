import type { Template } from "../../lib/types";

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
}

const categoryIcons: Record<string, string> = {
  identity: "\u{1F464}",
  finance: "\u{1F4B0}",
  travel: "\u{2708}\u{FE0F}",
  health: "\u{1F3E5}",
  social: "\u{1F91D}",
  utility: "\u{2699}\u{FE0F}",
};

export default function TemplateCard({ template, onUse }: TemplateCardProps) {
  const icon = categoryIcons[template.category.toLowerCase()] || "\u{1F4E6}";

  return (
    <div className="glass-card p-5 flex flex-col group hover:accent-glow">
      {/* Category badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{
            background: "var(--accent-subtle)",
            color: "var(--accent)",
          }}
        >
          {template.category}
        </span>
      </div>

      {/* Icon + Name */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <h3
          className="font-semibold text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          {template.name}
        </h3>
      </div>

      {/* Description */}
      <p
        className="text-xs leading-relaxed line-clamp-2 mb-4 flex-1"
        style={{ color: "var(--text-muted)" }}
      >
        {template.description}
      </p>

      {/* Use button */}
      <button
        className="btn-secondary w-full text-xs group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors"
        style={{ padding: "8px 16px" }}
        onClick={() => onUse(template)}
      >
        Use Template
      </button>
    </div>
  );
}
