import type { Template } from "../../lib/types";

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
}

export default function TemplateCard({ template, onUse }: TemplateCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">
        {template.category}
      </span>
      <h3 className="text-white font-semibold mt-2">{template.name}</h3>
      <p className="text-slate-400 text-sm line-clamp-2 mt-1 mb-3">
        {template.description}
      </p>
      <button
        className="w-full text-sm bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded transition-colors"
        onClick={() => onUse(template)}
      >
        Use Template
      </button>
    </div>
  );
}
