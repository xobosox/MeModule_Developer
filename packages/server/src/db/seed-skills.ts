import type postgres from "postgres";

interface SkillSeed {
  name: string;
  display_name: string;
  description: string;
  triggers: string[];
  agent_types: string[];
  prompt: string;
  code_snippets: Record<string, string>;
}

const skills: SkillSeed[] = [
  {
    name: "add-wallet",
    display_name: "Add Wallet Integration",
    description:
      "Integrate ShareRing wallet functionality including balance checks, payments, and transaction signing.",
    triggers: ["wallet", "payment", "balance", "SHR", "send", "transaction", "sign"],
    agent_types: ["generator", "iterator"],
    prompt: `When adding wallet functionality to a MeModule, use the ShareRing bridge events for all blockchain interactions. Never attempt direct RPC calls — all wallet operations go through the host app bridge.

Key bridge events:
- WALLET_CURRENT_ACCOUNT: Returns the user's wallet address. Call this on mount to display the connected account. The response contains { address: string }.
- WALLET_BALANCE: Retrieves the current SHR token balance. Returns { balance: string } in the smallest denomination. Format for display by dividing by 10^8.
- WALLET_SIGN_AND_BROADCAST_TRANSACTION: Send SHR tokens or interact with smart contracts. Requires { to: string, amount: string, memo?: string }. Returns { txHash: string } on success.

Implementation pattern:
1. Create a wallet store slice using Zustand to hold address, balance, and loading state.
2. On component mount, dispatch WALLET_CURRENT_ACCOUNT to populate the address.
3. Provide a refreshBalance() action that dispatches WALLET_BALANCE and updates the store.
4. For payments, build a confirmation UI showing recipient, amount, and memo before dispatching WALLET_SIGN_AND_BROADCAST_TRANSACTION.
5. Always handle errors gracefully — wrap bridge calls in try/catch and show user-friendly error toasts.
6. Display transaction hashes as truncated strings with a copy button.

Use TailwindCSS for styling. Keep amounts formatted with toLocaleString() for readability.`,
    code_snippets: {
      "wallet-store": `import { create } from 'zustand';
import { dispatchBridgeEvent } from './bridge';

interface WalletState {
  address: string | null;
  balance: string;
  loading: boolean;
  fetchAccount: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  sendPayment: (to: string, amount: string, memo?: string) => Promise<string>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  balance: '0',
  loading: false,
  fetchAccount: async () => {
    set({ loading: true });
    try {
      const res = await dispatchBridgeEvent('WALLET_CURRENT_ACCOUNT', {});
      set({ address: res.address });
    } finally {
      set({ loading: false });
    }
  },
  fetchBalance: async () => {
    const res = await dispatchBridgeEvent('WALLET_BALANCE', {});
    set({ balance: res.balance });
  },
  sendPayment: async (to, amount, memo) => {
    set({ loading: true });
    try {
      const res = await dispatchBridgeEvent('WALLET_SIGN_AND_BROADCAST_TRANSACTION', { to, amount, memo });
      await get().fetchBalance();
      return res.txHash;
    } finally {
      set({ loading: false });
    }
  },
}));`,
      "bridge-helper": `export async function dispatchBridgeEvent(event: string, payload: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackId = crypto.randomUUID();
    (window as any).__BRIDGE_CALLBACKS__ = (window as any).__BRIDGE_CALLBACKS__ || {};
    (window as any).__BRIDGE_CALLBACKS__[callbackId] = { resolve, reject };
    window.parent.postMessage({ type: event, callbackId, payload }, '*');
  });
}`,
    },
  },
  {
    name: "add-screen",
    display_name: "Add Screen / Route",
    description:
      "Create a new screen component with routing integration using React Router's hash router.",
    triggers: ["screen", "page", "view", "route"],
    agent_types: ["generator", "iterator"],
    prompt: `When adding a new screen to a MeModule, follow the established routing pattern using createHashRouter from react-router-dom.

Steps to add a new screen:
1. Create a new .tsx file in src/screens/ (e.g., src/screens/ProfileScreen.tsx).
2. Export a default React component that represents the full screen content.
3. Add the route to the router configuration in src/App.tsx or src/router.tsx inside the createHashRouter routes array.
4. Use a descriptive path like "/profile" — always lowercase, kebab-case.

Screen component structure:
- Wrap content in a container div with min-h-screen and appropriate padding.
- Include a header section with a back button (using useNavigate(-1)) and screen title.
- Use semantic sections for content grouping.
- Apply TailwindCSS utility classes for all styling — no inline styles or CSS modules.

Navigation between screens:
- Use the Link component from react-router-dom for declarative navigation.
- Use the useNavigate hook for programmatic navigation (e.g., after form submission).
- Pass state via route params or Zustand store — avoid prop drilling.

Each screen should be self-contained with its own data fetching logic. Use useEffect for initial data loading and show appropriate loading/error states.`,
    code_snippets: {
      "screen-template": `import { useNavigate } from 'react-router-dom';

export default function NewScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Screen Title</h1>
      </header>
      <main>
        {/* Screen content */}
      </main>
    </div>
  );
}`,
    },
  },
  {
    name: "add-vault",
    display_name: "Add Vault / Identity",
    description:
      "Access user identity documents and verified credentials from the ShareRing Vault.",
    triggers: ["vault", "document", "identity", "passport", "verify"],
    agent_types: ["generator", "iterator"],
    prompt: `The ShareRing Vault stores user identity documents and verified credentials. Access vault data through bridge events — never store sensitive identity data locally.

Key bridge events:
- VAULT_DOCUMENTS: Retrieve a list of the user's stored documents. Returns { documents: Array<{ type: string, status: string, id: string }> }. Document types include "passport", "drivers_license", "national_id", "proof_of_address".
- VAULT_EMAIL: Get the user's verified email address. Returns { email: string, verified: boolean }.
- VAULT_EXEC_QUERY: Execute a structured query against vault data. Pass { query: string, fields: string[] } to request specific verified fields. Returns the requested data if the user grants permission.

Implementation guidelines:
1. Always request the minimum data needed — only query fields your MeModule actually uses.
2. The user will see a consent prompt for each vault access. Design your UX to explain why data is needed before requesting it.
3. Cache vault responses in component state for the session, but never persist to localStorage.
4. Handle the case where users deny vault access gracefully — show a message explaining what features are unavailable.
5. Display document verification status with appropriate visual indicators (green check for verified, yellow for pending).
6. For identity verification flows, use a multi-step approach: explain -> request -> confirm -> proceed.

Use skeleton loading states while vault data is being fetched. Format all personal data with appropriate masking (e.g., show only last 4 of document numbers).`,
    code_snippets: {
      "vault-fetch": `import { dispatchBridgeEvent } from './bridge';

export async function fetchVaultDocuments() {
  const { documents } = await dispatchBridgeEvent('VAULT_DOCUMENTS', {});
  return documents as Array<{ type: string; status: string; id: string }>;
}

export async function fetchVerifiedEmail() {
  const { email, verified } = await dispatchBridgeEvent('VAULT_EMAIL', {});
  return { email: email as string, verified: verified as boolean };
}

export async function queryVault(query: string, fields: string[]) {
  return dispatchBridgeEvent('VAULT_EXEC_QUERY', { query, fields });
}`,
    },
  },
  {
    name: "add-storage",
    display_name: "Add Local Storage",
    description:
      "Persist data locally using the ShareRing async storage bridge for key-value storage.",
    triggers: ["storage", "save", "persist", "remember", "cache", "local"],
    agent_types: ["generator", "iterator"],
    prompt: `MeModules run in a sandboxed WebView and do not have direct access to localStorage. Instead, use the ShareRing bridge async storage events for persistent key-value storage.

Key bridge events:
- COMMON_READ_ASYNC_STORAGE: Read a value by key. Dispatch with { key: string }. Returns { value: string | null }. Values are always strings — parse JSON as needed.
- COMMON_WRITE_ASYNC_STORAGE: Write a value by key. Dispatch with { key: string, value: string }. Returns { success: boolean }. Always JSON.stringify objects before storing.

Implementation pattern:
1. Create a storage utility module with typed get/set functions.
2. Use a consistent key prefix for your MeModule to avoid collisions (e.g., "mymodule:settings").
3. Wrap read/write in try/catch — storage operations can fail if the device is low on space.
4. For complex state, serialize entire objects as JSON strings rather than storing individual fields.
5. Load persisted state during app initialization and merge with defaults.
6. Debounce writes when storing frequently-changing data (e.g., form drafts) to avoid excessive bridge calls.

Best practices:
- Keep stored data small — async storage is for preferences and small datasets, not large blobs.
- Provide sensible defaults when storage returns null (first launch scenario).
- Use a version key to handle schema migrations when your storage format changes.
- Consider using a Zustand persist middleware pattern for automatic state hydration.`,
    code_snippets: {
      "storage-util": `import { dispatchBridgeEvent } from './bridge';

const PREFIX = 'memodule';

export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await dispatchBridgeEvent('COMMON_READ_ASYNC_STORAGE', {
      key: \`\${PREFIX}:\${key}\`,
    });
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export async function storageSet<T>(key: string, data: T): Promise<void> {
  await dispatchBridgeEvent('COMMON_WRITE_ASYNC_STORAGE', {
    key: \`\${PREFIX}:\${key}\`,
    value: JSON.stringify(data),
  });
}`,
      "zustand-persist": `import { storageGet, storageSet } from './storage';

// Usage with Zustand: hydrate on mount, persist on change
export function withPersist<T extends object>(
  storeName: string,
  initialState: T,
  set: (partial: Partial<T>) => void
) {
  storageGet<Partial<T>>(storeName, {}).then((saved) => {
    set({ ...initialState, ...saved });
  });

  return (partial: Partial<T>) => {
    set(partial);
    storageGet<T>(storeName, initialState).then((current) => {
      storageSet(storeName, { ...current, ...partial });
    });
  };
}`,
    },
  },
  {
    name: "add-navigation",
    display_name: "Add Navigation Actions",
    description:
      "Navigate within the host app, open external links, or handle deep links through bridge events.",
    triggers: ["link", "navigate", "back", "external", "deep"],
    agent_types: ["generator", "iterator"],
    prompt: `MeModules can trigger navigation actions in the host ShareRing app using bridge events. This includes navigating to other app sections, opening external URLs, and handling back navigation.

Key bridge events:
- NAVIGATE_TO: Navigate to a specific section in the host app. Dispatch with { route: string, params?: Record<string, string> }. Common routes: "home", "vault", "settings", "scan".
- NAVIGATE_BACK: Return to the previous screen in the host app's navigation stack. Dispatch with {} (no payload needed). Use this for the MeModule's top-level back button.
- NAVIGATE_OPEN_LINK: Open an external URL in the device's default browser. Dispatch with { url: string }. Always validate URLs before opening. Returns { opened: boolean }.

Implementation guidelines:
1. Use NAVIGATE_BACK for the main screen's back/close button to return to the MeModule list.
2. Internal MeModule navigation (between your own screens) should use react-router — only use NAVIGATE_TO for host app navigation.
3. When opening external links, show the URL to the user and confirm before dispatching NAVIGATE_OPEN_LINK.
4. For deep link handling, register patterns in your MeModule manifest and handle incoming params in your root component.
5. Always provide visual feedback when triggering navigation — disable buttons and show loading states to prevent double-taps.

Navigation UX best practices:
- Place the back button in the top-left corner following platform conventions.
- Use consistent header heights (h-14) across all screens.
- Animate page transitions using react-router or framer-motion.
- Handle hardware back button on Android by wiring up NAVIGATE_BACK.`,
    code_snippets: {
      "nav-helpers": `import { dispatchBridgeEvent } from './bridge';

export async function navigateToHostRoute(route: string, params?: Record<string, string>) {
  await dispatchBridgeEvent('NAVIGATE_TO', { route, ...params });
}

export async function navigateBack() {
  await dispatchBridgeEvent('NAVIGATE_BACK', {});
}

export async function openExternalLink(url: string): Promise<boolean> {
  const { opened } = await dispatchBridgeEvent('NAVIGATE_OPEN_LINK', { url });
  return opened as boolean;
}`,
    },
  },
  {
    name: "style-guide",
    display_name: "Style Guide & Theming",
    description:
      "Apply ShareRing brand guidelines, dark/light theme support, and consistent styling with TailwindCSS.",
    triggers: ["brand", "color", "theme", "style", "dark", "light"],
    agent_types: ["designer", "generator", "iterator"],
    prompt: `MeModules use TailwindCSS for all styling. Follow these design guidelines for a consistent look and feel that integrates with the ShareRing ecosystem.

Color palette:
- Primary: blue-600 (light) / blue-500 (dark) — used for CTAs, active states, links.
- Background: white / gray-900 — use bg-white dark:bg-gray-900 for page backgrounds.
- Surface: gray-50 / gray-800 — use for cards, panels, and elevated surfaces.
- Border: gray-200 / gray-700 — consistent border colors across themes.
- Text: gray-900 / white for headings, gray-600 / gray-400 for secondary text.

Dark theme implementation:
- Always include dark: variants for every color utility.
- The host app controls the theme — check the "dark" class on the html element.
- Test both themes thoroughly — never hardcode colors without dark variants.

Typography:
- Headings: text-xl font-semibold (h1), text-lg font-medium (h2), text-base font-medium (h3).
- Body: text-sm text-gray-600 dark:text-gray-400.
- Labels: text-xs font-medium uppercase tracking-wide text-gray-500.

Spacing:
- Page padding: p-4 on mobile, sm:p-6 on larger screens.
- Section gaps: space-y-4 or space-y-6 between content blocks.
- Card padding: p-4, with rounded-xl and shadow-sm.

Components should feel native to the ShareRing app. Use smooth transitions (transition-colors duration-150), subtle shadows, and rounded corners (rounded-xl for cards, rounded-lg for buttons, rounded-full for avatars).`,
    code_snippets: {
      "themed-card": `interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={\`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 \${className}\`}>
      <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">{title}</h3>
      <div className="text-sm text-gray-600 dark:text-gray-400">{children}</div>
    </div>
  );
}`,
    },
  },
  {
    name: "add-form",
    display_name: "Add Form / Input",
    description:
      "Build multi-step forms with validation, input handling, and submission patterns.",
    triggers: ["form", "input", "survey", "field", "validate", "submit"],
    agent_types: ["generator", "iterator"],
    prompt: `When building forms in a MeModule, use controlled React components with useState for state management. For multi-step forms, track the current step index in state.

Form architecture:
1. Define a FormData type with all fields across all steps.
2. Use useState<FormData> with sensible defaults for the complete form state.
3. Track the current step with useState<number>(0).
4. Each step is a separate component receiving formData and onChange props.
5. Validate the current step before allowing advancement to the next step.

Validation approach:
- Validate on blur for individual fields (show errors after user leaves the field).
- Validate on step advancement (prevent moving forward with invalid data).
- Use a simple errors Record<string, string> in state — no need for heavy form libraries.
- Show error messages below inputs with text-red-500 text-xs mt-1.

Input styling (TailwindCSS):
- Inputs: w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent.
- Labels: block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.
- Error state: border-red-500 focus:ring-red-500.

Submission:
- Disable the submit button and show a spinner during submission.
- On success, show a confirmation screen or navigate away.
- On error, preserve form data and show the error message.
- Consider auto-saving drafts to async storage for long forms.`,
    code_snippets: {
      "multi-step-form": `import { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  message: string;
}

const STEPS = ['Details', 'Message', 'Review'];

export default function MultiStepForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof FormData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const validateStep = () => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!data.name.trim()) errs.name = 'Name is required';
      if (!data.email.includes('@')) errs.email = 'Valid email required';
    }
    if (step === 1 && !data.message.trim()) errs.message = 'Message is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };
  const back = () => setStep((s) => s - 1);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className={\`flex-1 h-1 rounded-full \${i <= step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}\`} />
        ))}
      </div>
      {step === 0 && (
        <div className="space-y-3">
          <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" placeholder="Name" value={data.name} onChange={(e) => update('name', e.target.value)} />
          {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
          <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" placeholder="Email" value={data.email} onChange={(e) => update('email', e.target.value)} />
          {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
        </div>
      )}
      {step === 1 && (
        <textarea className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 h-32" placeholder="Your message" value={data.message} onChange={(e) => update('message', e.target.value)} />
      )}
      {step === 2 && <pre className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">{JSON.stringify(data, null, 2)}</pre>}
      <div className="flex gap-3">
        {step > 0 && <button onClick={back} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600">Back</button>}
        {step < 2 ? <button onClick={next} className="px-4 py-2 rounded-lg bg-blue-600 text-white ml-auto">Next</button> : <button onClick={() => onSubmit(data)} className="px-4 py-2 rounded-lg bg-blue-600 text-white ml-auto">Submit</button>}
      </div>
    </div>
  );
}`,
    },
  },
  {
    name: "add-list",
    display_name: "Add List / Grid",
    description:
      "Build responsive lists and grids with loading states, empty states, and card components.",
    triggers: ["list", "grid", "card", "table", "items", "collection"],
    agent_types: ["generator", "iterator"],
    prompt: `When displaying collections of data in a MeModule, use responsive grid layouts with TailwindCSS. Always handle three states: loading, empty, and populated.

Grid layout patterns:
- Single column on mobile, 2 columns on sm, 3 on lg: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4".
- For list views (no grid): use "space-y-3" with full-width card items.
- For horizontal scrolling: "flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2" with snap-start on children.

Loading state:
- Show skeleton cards matching the expected layout.
- Use animate-pulse with bg-gray-200 dark:bg-gray-700 blocks for content placeholders.
- Match the number of skeleton items to a reasonable expected count (3-6).

Empty state:
- Center vertically and horizontally in the available space.
- Include an illustrative icon (use an SVG or emoji), a heading, a description, and an optional CTA button.
- Use muted colors: text-gray-400 dark:text-gray-500.

Card component guidelines:
- Consistent padding (p-4), rounded corners (rounded-xl), subtle border and shadow.
- Include a visual element (image, icon, or color indicator) at the top or left.
- Primary info (title, key metric) should be prominent.
- Secondary info (date, status, description) in smaller, muted text.
- Optional action button or chevron for drill-down navigation.
- Apply hover:shadow-md transition-shadow for interactive cards.

For large lists (50+ items), consider implementing virtual scrolling or pagination to maintain performance.`,
    code_snippets: {
      "responsive-grid": `interface Item {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'inactive';
}

function ItemCard({ item }: { item: Item }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 dark:text-white">{item.title}</h3>
        <span className={\`text-xs px-2 py-0.5 rounded-full \${item.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}\`}>
          {item.status}
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{item.description}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
    </div>
  );
}

export function ItemGrid({ items, loading }: { items: Item[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No items yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Items will appear here once created.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => <ItemCard key={item.id} item={item} />)}
    </div>
  );
}`,
    },
  },
];

export async function seedSkills(sql: postgres.Sql): Promise<void> {
  for (const skill of skills) {
    await sql`
      INSERT INTO skills (name, display_name, description, triggers, agent_types, prompt, code_snippets)
      VALUES (
        ${skill.name},
        ${skill.display_name},
        ${skill.description},
        ${sql.array(skill.triggers)},
        ${sql.array(skill.agent_types)},
        ${skill.prompt},
        ${JSON.stringify(skill.code_snippets)}
      )
      ON CONFLICT (name) DO NOTHING
    `;
  }
  console.log("Skills seeded (8 domain skills).");
}
