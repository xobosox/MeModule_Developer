import type postgres from "postgres";

/* ──────────────────────────────────────────────────────────────────────
   Shared helpers
   ────────────────────────────────────────────────────────────────────── */

const manifest = (version = "0.0.1") =>
  JSON.stringify(
    {
      version,
      offline_mode: false,
      isMaintenance: false,
      enable_secure_screen: false,
    },
    null,
    2,
  );

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Module</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const mainTsx = `import React from "react";
import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);`;

const meBridgeTs = `declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

interface BridgeMessage {
  type: string;
  payload?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT = 30_000;

export function createShareRingMeBridge() {
  const queue: Array<() => void> = [];
  let processing = false;
  const pending = new Map<string, PendingRequest>();

  function generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function processQueue() {
    if (processing) return;
    processing = true;
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) await next();
    }
    processing = false;
  }

  function send(
    type: string,
    payload?: unknown,
    timeout: number = DEFAULT_TIMEOUT,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        return new Promise<void>((done) => {
          const id = generateId();
          const upperType = type.toUpperCase();

          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(\`Bridge message "\${upperType}" timed out after \${timeout}ms\`));
            done();
          }, timeout);

          pending.set(id, {
            resolve: (value: unknown) => {
              clearTimeout(timer);
              pending.delete(id);
              resolve(value);
              done();
            },
            reject: (reason: unknown) => {
              clearTimeout(timer);
              pending.delete(id);
              reject(reason);
              done();
            },
            timer,
          });

          const message: BridgeMessage & { id: string } = {
            id,
            type: upperType,
            payload,
          };

          window.ReactNativeWebView?.postMessage(JSON.stringify(message));
        });
      });
      processQueue();
    });
  }

  function receive(id: string, payload: unknown) {
    const request = pending.get(id);
    if (request) {
      request.resolve(payload);
    }
  }

  return { send, receive };
}`;

/* ──────────────────────────────────────────────────────────────────────
   1. Loyalty Card
   ────────────────────────────────────────────────────────────────────── */

const loyaltyCard = {
  name: "Loyalty Card",
  description: "Stamp tracking and reward redemption for businesses",
  category: "loyalty",
  tags: ["loyalty", "stamps", "rewards"],
  file_tree: {
    "manifest.json": manifest(),
    "index.html": indexHtml,
    "src/main.tsx": mainTsx,
    "src/services/me-bridge.ts": meBridgeTs,

    "src/App.tsx": `import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import StampCard from "./screens/StampCard";
import Rewards from "./screens/Rewards";
import History from "./screens/History";

const router = createHashRouter([
  { path: "/", element: <StampCard /> },
  { path: "/rewards", element: <Rewards /> },
  { path: "/history", element: <History /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}`,

    "src/store/app-store.ts": `import { create } from "zustand";

export interface Reward {
  id: string;
  name: string;
  stampsRequired: number;
}

export interface Redemption {
  rewardName: string;
  redeemedAt: string;
}

interface AppState {
  stamps: number;
  totalNeeded: number;
  userAddress: string;
  rewards: Reward[];
  history: Redemption[];
  addStamp: () => void;
  resetStamps: () => void;
  setUserAddress: (addr: string) => void;
  redeemReward: (reward: Reward) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  stamps: 0,
  totalNeeded: 10,
  userAddress: "",
  rewards: [
    { id: "1", name: "Free Coffee", stampsRequired: 5 },
    { id: "2", name: "Free Pastry", stampsRequired: 8 },
    { id: "3", name: "50% Off Any Item", stampsRequired: 10 },
  ],
  history: [],
  addStamp: () =>
    set((s) => ({ stamps: Math.min(s.stamps + 1, s.totalNeeded) })),
  resetStamps: () => set({ stamps: 0 }),
  setUserAddress: (addr: string) => set({ userAddress: addr }),
  redeemReward: (reward: Reward) => {
    const { stamps, history } = get();
    if (stamps >= reward.stampsRequired) {
      set({
        stamps: stamps - reward.stampsRequired,
        history: [
          { rewardName: reward.name, redeemedAt: new Date().toISOString() },
          ...history,
        ],
      });
    }
  },
}));`,

    "src/screens/StampCard.tsx": `import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { createShareRingMeBridge } from "../services/me-bridge";

const bridge = createShareRingMeBridge();

export default function StampCard() {
  const { stamps, totalNeeded, addStamp, setUserAddress } = useAppStore();

  useEffect(() => {
    bridge.send("WALLET_CURRENT_ACCOUNT").then((res: any) => {
      if (res?.address) setUserAddress(res.address);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <h1 className="text-2xl font-bold text-center mb-6">Loyalty Card</h1>

      <div className="grid grid-cols-5 gap-3 max-w-xs mx-auto mb-8">
        {Array.from({ length: totalNeeded }).map((_, i) => (
          <button
            key={i}
            onClick={addStamp}
            className={\`w-14 h-14 rounded-full flex items-center justify-center text-xl transition \${
              i < stamps
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30"
                : "bg-slate-800 border border-slate-700 text-slate-500"
            }\`}
          >
            {i < stamps ? "\\u2605" : "\\u2606"}
          </button>
        ))}
      </div>

      <p className="text-center text-slate-400 mb-8">
        {stamps} / {totalNeeded} stamps collected
      </p>

      <nav className="flex gap-4 justify-center">
        <Link to="/rewards" className="px-4 py-2 bg-amber-600 rounded-lg font-medium hover:bg-amber-500 transition">
          Rewards
        </Link>
        <Link to="/history" className="px-4 py-2 bg-slate-800 rounded-lg font-medium hover:bg-slate-700 transition">
          History
        </Link>
      </nav>
    </div>
  );
}`,

    "src/screens/Rewards.tsx": `import React from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export default function Rewards() {
  const { stamps, rewards, redeemReward } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="flex items-center mb-6">
        <Link to="/" className="text-amber-400 mr-3">\\u2190</Link>
        <h1 className="text-2xl font-bold">Rewards</h1>
      </div>

      <p className="text-slate-400 mb-4">You have {stamps} stamps</p>

      <div className="space-y-3">
        {rewards.map((r) => (
          <div key={r.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-slate-400">{r.stampsRequired} stamps needed</p>
            </div>
            <button
              disabled={stamps < r.stampsRequired}
              onClick={() => redeemReward(r)}
              className={\`px-3 py-1.5 rounded-lg text-sm font-medium transition \${
                stamps >= r.stampsRequired
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }\`}
            >
              Redeem
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}`,

    "src/screens/History.tsx": `import React from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export default function History() {
  const { history } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="flex items-center mb-6">
        <Link to="/" className="text-amber-400 mr-3">\\u2190</Link>
        <h1 className="text-2xl font-bold">Redemption History</h1>
      </div>

      {history.length === 0 ? (
        <p className="text-slate-500 text-center mt-12">No redemptions yet</p>
      ) : (
        <div className="space-y-3">
          {history.map((h, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-4">
              <p className="font-semibold">{h.rewardName}</p>
              <p className="text-sm text-slate-400">
                {new Date(h.redeemedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}`,
  },
};

/* ──────────────────────────────────────────────────────────────────────
   2. Event Check-in
   ────────────────────────────────────────────────────────────────────── */

const eventCheckin = {
  name: "Event Check-in",
  description: "Attendee check-in and event management",
  category: "events",
  tags: ["events", "checkin", "attendance"],
  file_tree: {
    "manifest.json": manifest(),
    "index.html": indexHtml,
    "src/main.tsx": mainTsx,
    "src/services/me-bridge.ts": meBridgeTs,

    "src/App.tsx": `import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import EventList from "./screens/EventList";
import CheckIn from "./screens/CheckIn";
import History from "./screens/History";

const router = createHashRouter([
  { path: "/", element: <EventList /> },
  { path: "/checkin/:eventId", element: <CheckIn /> },
  { path: "/history", element: <History /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}`,

    "src/store/app-store.ts": `import { create } from "zustand";

export interface EventItem {
  id: string;
  name: string;
  date: string;
  location: string;
  description: string;
}

export interface CheckInRecord {
  eventId: string;
  eventName: string;
  checkedInAt: string;
}

interface AppState {
  userAddress: string;
  events: EventItem[];
  checkedInEvents: Set<string>;
  history: CheckInRecord[];
  setUserAddress: (addr: string) => void;
  checkIn: (event: EventItem) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  userAddress: "",
  events: [
    {
      id: "1",
      name: "Web3 Developer Meetup",
      date: "2026-04-15",
      location: "Innovation Hub, Level 3",
      description: "Monthly meetup for Web3 developers to share projects and ideas.",
    },
    {
      id: "2",
      name: "DeFi Workshop",
      date: "2026-04-22",
      location: "Tech Campus, Room 201",
      description: "Hands-on workshop covering DeFi protocols and smart contract development.",
    },
    {
      id: "3",
      name: "Blockchain Conference 2026",
      date: "2026-05-10",
      location: "Convention Center, Main Hall",
      description: "Annual conference featuring keynotes, panels, and networking.",
    },
  ],
  checkedInEvents: new Set<string>(),
  history: [],
  setUserAddress: (addr: string) => set({ userAddress: addr }),
  checkIn: (event: EventItem) => {
    const { checkedInEvents, history } = get();
    if (checkedInEvents.has(event.id)) return;
    const next = new Set(checkedInEvents);
    next.add(event.id);
    set({
      checkedInEvents: next,
      history: [
        {
          eventId: event.id,
          eventName: event.name,
          checkedInAt: new Date().toISOString(),
        },
        ...history,
      ],
    });
  },
}));`,

    "src/screens/EventList.tsx": `import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { createShareRingMeBridge } from "../services/me-bridge";

const bridge = createShareRingMeBridge();

export default function EventList() {
  const { events, checkedInEvents, setUserAddress } = useAppStore();

  useEffect(() => {
    bridge.send("WALLET_CURRENT_ACCOUNT").then((res: any) => {
      if (res?.address) setUserAddress(res.address);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Events</h1>
        <Link to="/history" className="text-sm text-sky-400 hover:text-sky-300">
          History
        </Link>
      </div>

      <div className="space-y-3">
        {events.map((ev) => {
          const done = checkedInEvents.has(ev.id);
          return (
            <Link
              key={ev.id}
              to={\`/checkin/\${ev.id}\`}
              className="block bg-slate-900 rounded-lg p-4 hover:bg-slate-800 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-lg">{ev.name}</p>
                  <p className="text-sm text-slate-400 mt-1">{ev.date} &middot; {ev.location}</p>
                </div>
                {done && (
                  <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full">
                    Checked In
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}`,

    "src/screens/CheckIn.tsx": `import React from "react";
import { useParams, Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export default function CheckIn() {
  const { eventId } = useParams<{ eventId: string }>();
  const { events, checkedInEvents, checkIn } = useAppStore();
  const event = events.find((e) => e.id === eventId);

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 flex items-center justify-center">
        <p className="text-slate-400">Event not found</p>
      </div>
    );
  }

  const isCheckedIn = checkedInEvents.has(event.id);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <Link to="/" className="text-sky-400 text-sm">\\u2190 Back to events</Link>

      <div className="mt-6 bg-slate-900 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2">{event.name}</h1>
        <p className="text-slate-400 mb-1">{event.date}</p>
        <p className="text-slate-400 mb-4">{event.location}</p>
        <p className="text-slate-300 mb-6">{event.description}</p>

        {isCheckedIn ? (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 text-center">
            <p className="text-green-300 text-lg font-semibold">\\u2713 Checked In</p>
            <p className="text-green-400/70 text-sm mt-1">You are checked in to this event.</p>
          </div>
        ) : (
          <button
            onClick={() => checkIn(event)}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 rounded-lg font-semibold text-lg transition"
          >
            Check In Now
          </button>
        )}
      </div>
    </div>
  );
}`,

    "src/screens/History.tsx": `import React from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export default function History() {
  const { history } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="flex items-center mb-6">
        <Link to="/" className="text-sky-400 mr-3">\\u2190</Link>
        <h1 className="text-2xl font-bold">Check-in History</h1>
      </div>

      {history.length === 0 ? (
        <p className="text-slate-500 text-center mt-12">No check-ins yet</p>
      ) : (
        <div className="space-y-3">
          {history.map((h, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-4">
              <p className="font-semibold">{h.eventName}</p>
              <p className="text-sm text-slate-400">
                {new Date(h.checkedInAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}`,
  },
};

/* ──────────────────────────────────────────────────────────────────────
   3. Survey / Form
   ────────────────────────────────────────────────────────────────────── */

const surveyForm = {
  name: "Survey / Form",
  description: "Multi-step form builder with results collection",
  category: "surveys",
  tags: ["survey", "form", "data"],
  file_tree: {
    "manifest.json": manifest(),
    "index.html": indexHtml,
    "src/main.tsx": mainTsx,
    "src/services/me-bridge.ts": meBridgeTs,

    "src/App.tsx": `import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import SurveyList from "./screens/SurveyList";
import SurveyForm from "./screens/SurveyForm";
import ThankYou from "./screens/ThankYou";

const router = createHashRouter([
  { path: "/", element: <SurveyList /> },
  { path: "/survey/:surveyId", element: <SurveyForm /> },
  { path: "/thankyou", element: <ThankYou /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}`,

    "src/store/app-store.ts": `import { create } from "zustand";

export interface Question {
  id: string;
  text: string;
  type: "text" | "choice" | "rating";
  options?: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

interface AppState {
  surveys: Survey[];
  answers: Record<string, string>;
  currentStep: number;
  submitted: boolean;
  activeSurveyId: string | null;
  email: string;
  setAnswer: (questionId: string, value: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetForm: () => void;
  submit: () => void;
  setActiveSurvey: (id: string) => void;
  setEmail: (email: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  surveys: [
    {
      id: "1",
      title: "Customer Satisfaction",
      description: "Help us improve our service by answering a few questions.",
      questions: [
        { id: "q1", text: "How would you rate our service?", type: "rating" },
        {
          id: "q2",
          text: "What did you enjoy most?",
          type: "choice",
          options: ["Speed", "Quality", "Support", "Price"],
        },
        { id: "q3", text: "Any additional feedback?", type: "text" },
      ],
    },
    {
      id: "2",
      title: "Product Feedback",
      description: "Tell us what you think about our latest product.",
      questions: [
        { id: "q1", text: "Rate the product overall", type: "rating" },
        {
          id: "q2",
          text: "Which feature do you use most?",
          type: "choice",
          options: ["Dashboard", "Analytics", "Notifications", "Settings"],
        },
        { id: "q3", text: "What feature would you like to see next?", type: "text" },
      ],
    },
  ],
  answers: {},
  currentStep: 0,
  submitted: false,
  activeSurveyId: null,
  email: "",
  setAnswer: (questionId, value) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: value } })),
  nextStep: () => set((s) => ({ currentStep: s.currentStep + 1 })),
  prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
  resetForm: () => set({ answers: {}, currentStep: 0, submitted: false, activeSurveyId: null }),
  submit: () => set({ submitted: true }),
  setActiveSurvey: (id) => set({ activeSurveyId: id, currentStep: 0, answers: {}, submitted: false }),
  setEmail: (email) => set({ email }),
}));`,

    "src/screens/SurveyList.tsx": `import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { createShareRingMeBridge } from "../services/me-bridge";

const bridge = createShareRingMeBridge();

export default function SurveyList() {
  const { surveys, setEmail } = useAppStore();

  useEffect(() => {
    bridge.send("VAULT_EMAIL").then((res: any) => {
      if (res?.email) setEmail(res.email);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">Surveys</h1>

      <div className="space-y-3">
        {surveys.map((s) => (
          <Link
            key={s.id}
            to={\`/survey/\${s.id}\`}
            className="block bg-slate-900 rounded-lg p-4 hover:bg-slate-800 transition"
          >
            <p className="font-semibold text-lg">{s.title}</p>
            <p className="text-sm text-slate-400 mt-1">{s.description}</p>
            <p className="text-xs text-slate-500 mt-2">{s.questions.length} questions</p>
          </Link>
        ))}
      </div>
    </div>
  );
}`,

    "src/screens/SurveyForm.tsx": `import React, { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export default function SurveyForm() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const {
    surveys,
    answers,
    currentStep,
    setAnswer,
    nextStep,
    prevStep,
    submit,
    setActiveSurvey,
  } = useAppStore();

  const survey = surveys.find((s) => s.id === surveyId);

  useEffect(() => {
    if (surveyId) setActiveSurvey(surveyId);
  }, [surveyId]);

  if (!survey) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 flex items-center justify-center">
        <p className="text-slate-400">Survey not found</p>
      </div>
    );
  }

  const question = survey.questions[currentStep];
  const isLast = currentStep === survey.questions.length - 1;
  const answer = answers[question?.id] || "";

  const handleNext = () => {
    if (isLast) {
      submit();
      navigate("/thankyou");
    } else {
      nextStep();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <Link to="/" className="text-violet-400 text-sm">\\u2190 Back to surveys</Link>

      <h1 className="text-xl font-bold mt-4 mb-1">{survey.title}</h1>
      <p className="text-sm text-slate-400 mb-6">
        Question {currentStep + 1} of {survey.questions.length}
      </p>

      <div className="bg-slate-900 rounded-xl p-6 mb-6">
        <p className="text-lg font-medium mb-4">{question.text}</p>

        {question.type === "text" && (
          <textarea
            value={answer}
            onChange={(e) => setAnswer(question.id, e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white resize-none h-24 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Type your answer..."
          />
        )}

        {question.type === "choice" && question.options && (
          <div className="space-y-2">
            {question.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswer(question.id, opt)}
                className={\`w-full text-left p-3 rounded-lg transition \${
                  answer === opt
                    ? "bg-violet-600 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }\`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {question.type === "rating" && (
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setAnswer(question.id, String(n))}
                className={\`w-12 h-12 rounded-full text-lg font-bold transition \${
                  answer === String(n)
                    ? "bg-violet-600 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                }\`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {currentStep > 0 && (
          <button
            onClick={prevStep}
            className="flex-1 py-3 bg-slate-800 rounded-lg font-medium hover:bg-slate-700 transition"
          >
            Previous
          </button>
        )}
        <button
          onClick={handleNext}
          className="flex-1 py-3 bg-violet-600 rounded-lg font-semibold hover:bg-violet-500 transition"
        >
          {isLast ? "Submit" : "Next"}
        </button>
      </div>
    </div>
  );
}`,

    "src/screens/ThankYou.tsx": `import React from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export default function ThankYou() {
  const { resetForm } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl p-8 text-center max-w-sm w-full">
        <div className="text-5xl mb-4">\\u2713</div>
        <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
        <p className="text-slate-400 mb-6">
          Your response has been submitted successfully.
        </p>
        <Link
          to="/"
          onClick={resetForm}
          className="inline-block px-6 py-3 bg-violet-600 rounded-lg font-medium hover:bg-violet-500 transition"
        >
          Back to Surveys
        </Link>
      </div>
    </div>
  );
}`,
  },
};

/* ──────────────────────────────────────────────────────────────────────
   4. Payment
   ────────────────────────────────────────────────────────────────────── */

const payment = {
  name: "Payment",
  description: "Simple SHR payment flow with wallet integration",
  category: "payments",
  tags: ["payment", "shr", "wallet"],
  file_tree: {
    "manifest.json": manifest(),
    "index.html": indexHtml,
    "src/main.tsx": mainTsx,
    "src/services/me-bridge.ts": meBridgeTs,

    "src/App.tsx": `import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import PaymentForm from "./screens/PaymentForm";
import Confirm from "./screens/Confirm";
import Result from "./screens/Result";

const router = createHashRouter([
  { path: "/", element: <PaymentForm /> },
  { path: "/confirm", element: <Confirm /> },
  { path: "/result", element: <Result /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}`,

    "src/store/app-store.ts": `import { create } from "zustand";

interface AppState {
  amount: string;
  recipient: string;
  balance: string;
  senderAddress: string;
  txHash: string;
  status: "idle" | "pending" | "success" | "error";
  errorMessage: string;
  setAmount: (amount: string) => void;
  setRecipient: (recipient: string) => void;
  setBalance: (balance: string) => void;
  setSenderAddress: (addr: string) => void;
  setTxHash: (hash: string) => void;
  setStatus: (status: "idle" | "pending" | "success" | "error") => void;
  setError: (msg: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  amount: "",
  recipient: "",
  balance: "0",
  senderAddress: "",
  txHash: "",
  status: "idle",
  errorMessage: "",
  setAmount: (amount) => set({ amount }),
  setRecipient: (recipient) => set({ recipient }),
  setBalance: (balance) => set({ balance }),
  setSenderAddress: (addr) => set({ senderAddress: addr }),
  setTxHash: (hash) => set({ txHash: hash }),
  setStatus: (status) => set({ status }),
  setError: (msg) => set({ errorMessage: msg, status: "error" }),
  reset: () =>
    set({ amount: "", recipient: "", txHash: "", status: "idle", errorMessage: "" }),
}));`,

    "src/screens/PaymentForm.tsx": `import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { createShareRingMeBridge } from "../services/me-bridge";

const bridge = createShareRingMeBridge();

export default function PaymentForm() {
  const { amount, recipient, balance, setAmount, setRecipient, setBalance, setSenderAddress, reset } =
    useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    reset();
    bridge.send("WALLET_CURRENT_ACCOUNT").then((res: any) => {
      if (res?.address) setSenderAddress(res.address);
    }).catch(() => {});
    bridge.send("WALLET_BALANCE").then((res: any) => {
      if (res?.balance != null) setBalance(String(res.balance));
    }).catch(() => {});
  }, []);

  const canProceed = amount && recipient && parseFloat(amount) > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <h1 className="text-2xl font-bold mb-2">Send Payment</h1>
      <p className="text-slate-400 mb-6">Balance: {balance} SHR</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Recipient Address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Amount (SHR)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          disabled={!canProceed}
          onClick={() => navigate("/confirm")}
          className={\`w-full py-3 rounded-lg font-semibold text-lg transition \${
            canProceed
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }\`}
        >
          Review Payment
        </button>
      </div>
    </div>
  );
}`,

    "src/screens/Confirm.tsx": `import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { createShareRingMeBridge } from "../services/me-bridge";

const bridge = createShareRingMeBridge();

export default function Confirm() {
  const { amount, recipient, senderAddress, setTxHash, setStatus, setError } = useAppStore();
  const navigate = useNavigate();

  const handleConfirm = async () => {
    setStatus("pending");
    try {
      const res: any = await bridge.send("WALLET_SIGN_AND_BROADCAST_TRANSACTION", {
        from: senderAddress,
        to: recipient,
        amount,
      });
      if (res?.txHash) {
        setTxHash(res.txHash);
        setStatus("success");
      } else {
        setError("Transaction failed: no hash returned");
      }
    } catch (err: any) {
      setError(err?.message || "Transaction failed");
    }
    navigate("/result");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">Confirm Payment</h1>

      <div className="bg-slate-900 rounded-xl p-6 space-y-4 mb-6">
        <div>
          <p className="text-sm text-slate-400">From</p>
          <p className="font-mono text-sm break-all">{senderAddress || "Connecting..."}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">To</p>
          <p className="font-mono text-sm break-all">{recipient}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Amount</p>
          <p className="text-2xl font-bold text-emerald-400">{amount} SHR</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate("/")}
          className="flex-1 py-3 bg-slate-800 rounded-lg font-medium hover:bg-slate-700 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-3 bg-emerald-600 rounded-lg font-semibold hover:bg-emerald-500 transition"
        >
          Confirm &amp; Send
        </button>
      </div>
    </div>
  );
}`,

    "src/screens/Result.tsx": `import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";

export default function Result() {
  const { status, txHash, errorMessage, amount, recipient, reset } = useAppStore();
  const navigate = useNavigate();

  const handleDone = () => {
    reset();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl p-8 text-center max-w-sm w-full">
        {status === "pending" && (
          <>
            <div className="text-4xl mb-4 animate-pulse">\\u23F3</div>
            <h1 className="text-xl font-bold">Processing...</h1>
            <p className="text-slate-400 mt-2">Please wait while your transaction is confirmed.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl mb-4 text-emerald-400">\\u2713</div>
            <h1 className="text-xl font-bold mb-2">Payment Sent!</h1>
            <p className="text-slate-400 mb-1">{amount} SHR sent to</p>
            <p className="font-mono text-xs text-slate-500 break-all mb-4">{recipient}</p>
            {txHash && (
              <p className="text-xs text-slate-500 break-all">
                TX: {txHash}
              </p>
            )}
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl mb-4 text-red-400">\\u2717</div>
            <h1 className="text-xl font-bold mb-2">Payment Failed</h1>
            <p className="text-red-400 text-sm">{errorMessage}</p>
          </>
        )}

        <button
          onClick={handleDone}
          className="mt-6 px-6 py-3 bg-emerald-600 rounded-lg font-medium hover:bg-emerald-500 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}`,
  },
};

/* ──────────────────────────────────────────────────────────────────────
   5. Info / Content
   ────────────────────────────────────────────────────────────────────── */

const infoContent = {
  name: "Info / Content",
  description: "Static content pages with navigation",
  category: "content",
  tags: ["info", "content", "pages"],
  file_tree: {
    "manifest.json": manifest(),
    "index.html": indexHtml,
    "src/main.tsx": mainTsx,
    "src/services/me-bridge.ts": meBridgeTs,

    "src/App.tsx": `import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Home from "./screens/Home";
import About from "./screens/About";
import Contact from "./screens/Contact";

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/about", element: <About /> },
  { path: "/contact", element: <Contact /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}`,

    "src/store/app-store.ts": `import { create } from "zustand";

interface AppInfo {
  language: string;
  darkMode: boolean;
}

interface AppState {
  appInfo: AppInfo;
  copied: boolean;
  setAppInfo: (info: AppInfo) => void;
  setCopied: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: { language: "en", darkMode: true },
  copied: false,
  setAppInfo: (info) => set({ appInfo: info }),
  setCopied: (val) => set({ copied: val }),
}));`,

    "src/screens/Home.tsx": `import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { createShareRingMeBridge } from "../services/me-bridge";

const bridge = createShareRingMeBridge();

export default function Home() {
  const { setAppInfo } = useAppStore();

  useEffect(() => {
    bridge.send("COMMON_APP_INFO").then((res: any) => {
      if (res) {
        setAppInfo({
          language: res.language || "en",
          darkMode: res.darkMode ?? true,
        });
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-2">Welcome</h1>
        <p className="text-slate-400 mb-8">
          This is a content module. Use the navigation below to explore pages.
        </p>

        <div className="space-y-3">
          <Link
            to="/about"
            className="block bg-slate-900 rounded-lg p-4 hover:bg-slate-800 transition"
          >
            <p className="font-semibold text-lg">About</p>
            <p className="text-sm text-slate-400">Learn more about us</p>
          </Link>

          <Link
            to="/contact"
            className="block bg-slate-900 rounded-lg p-4 hover:bg-slate-800 transition"
          >
            <p className="font-semibold text-lg">Contact</p>
            <p className="text-sm text-slate-400">Get in touch</p>
          </Link>
        </div>
      </div>
    </div>
  );
}`,

    "src/screens/About.tsx": `import React from "react";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <Link to="/" className="text-teal-400 text-sm">\\u2190 Home</Link>

      <div className="mt-6">
        <h1 className="text-2xl font-bold mb-4">About Us</h1>

        <div className="bg-slate-900 rounded-xl p-6 space-y-4 text-slate-300 leading-relaxed">
          <p>
            We are building the next generation of decentralized applications
            that put users in control of their data and digital identity.
          </p>
          <p>
            Our platform leverages blockchain technology to create secure,
            transparent, and user-friendly experiences for businesses and
            individuals alike.
          </p>
          <p>
            Founded with the mission to make Web3 accessible to everyone,
            we continue to push the boundaries of what is possible with
            decentralized technology.
          </p>
        </div>
      </div>
    </div>
  );
}`,

    "src/screens/Contact.tsx": `import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createShareRingMeBridge } from "../services/me-bridge";

const bridge = createShareRingMeBridge();

const CONTACT_INFO = [
  { label: "Email", value: "hello@example.com" },
  { label: "Phone", value: "+1 (555) 123-4567" },
  { label: "Address", value: "123 Blockchain Ave, Web3 City" },
];

export default function Contact() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    try {
      await bridge.send("COMMON_COPY_TO_CLIPBOARD", { text });
    } catch {
      // fallback to browser clipboard
      await navigator.clipboard?.writeText(text);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <Link to="/" className="text-teal-400 text-sm">\\u2190 Home</Link>

      <div className="mt-6">
        <h1 className="text-2xl font-bold mb-4">Contact Us</h1>

        <div className="space-y-3">
          {CONTACT_INFO.map((item, i) => (
            <div
              key={i}
              className="bg-slate-900 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-slate-400">{item.label}</p>
                <p className="font-medium">{item.value}</p>
              </div>
              <button
                onClick={() => handleCopy(item.value, i)}
                className={\`px-3 py-1.5 rounded-lg text-sm transition \${
                  copiedIndex === i
                    ? "bg-teal-900 text-teal-300"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }\`}
              >
                {copiedIndex === i ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`,
  },
};

/* ──────────────────────────────────────────────────────────────────────
   Seed function
   ────────────────────────────────────────────────────────────────────── */

const extendedTemplates = [loyaltyCard, eventCheckin, surveyForm, payment, infoContent];

export async function seedExtendedTemplates(sql: postgres.Sql) {
  for (const tpl of extendedTemplates) {
    const { name, description, category, tags, file_tree } = tpl;
    await sql`
      INSERT INTO templates (name, description, category, tags, file_tree)
      SELECT ${name}, ${description}, ${category}, ${sql.array(tags)}, ${sql.json(file_tree)}
      WHERE NOT EXISTS (
        SELECT 1 FROM templates WHERE name = ${name}
      )
    `;
  }
  console.log("Extended template seeding complete.");
}
