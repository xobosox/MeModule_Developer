type Tab = "plan" | "code" | "preview";

interface TabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "plan", label: "Plan", icon: "\uD83D\uDCCB" },
  { key: "code", label: "Code", icon: "\uD83D\uDCBB" },
  { key: "preview", label: "Preview", icon: "\uD83D\uDCF1" },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div
      className="flex items-center gap-1 px-4 py-2"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
            style={{
              background: isActive ? "var(--accent-subtle)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              border: isActive ? "1px solid rgba(6, 182, 212, 0.15)" : "1px solid transparent",
            }}
            onClick={() => onTabChange(tab.key)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.background = "var(--bg-surface-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
