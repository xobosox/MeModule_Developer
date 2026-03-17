import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setToken } from "../lib/auth";
import ThemeToggle from "../components/workspace/ThemeToggle";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sharering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "dev-user",
          sharering_address: "shareledger1devuser",
        }),
      });
      if (!res.ok) {
        throw new Error(`Login failed: ${res.status}`);
      }
      const data = await res.json();
      setToken(data.token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(1, 14, 208, 0.2) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 80% 20%, rgba(133, 141, 255, 0.15) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 50% 80%, rgba(1, 14, 208, 0.12) 0%, transparent 50%)",
          animation: "gradient-shift 15s ease infinite",
          backgroundSize: "200% 200%",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Login card */}
      <div className="glass-card accent-glow relative z-10 p-10 w-full max-w-md">
        {/* Logo / Wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)" }}
            />
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              ShareRing
            </span>
          </div>
          <h1
            className="text-3xl font-extrabold tracking-tight mb-2"
            style={{
              background: "linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MeModule Developer
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Build ShareRing Me Modules with AI
          </p>
        </div>

        {/* Description */}
        <p
          className="text-sm text-center mb-8 leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Design, generate, and iterate on Me Modules using AI-powered
          workflows. From concept to production-ready code.
        </p>

        {/* Error */}
        {error && (
          <div
            className="text-sm text-center mb-4 px-4 py-3 rounded-lg"
            style={{
              color: "var(--error)",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            {error}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={{ padding: "12px 20px", fontSize: "15px" }}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" className="opacity-75" />
              </svg>
              Signing in...
            </>
          ) : (
            "Sign in with ShareRing"
          )}
        </button>

        {/* Footer */}
        <p
          className="text-sm text-center mt-8 font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Powered by{" "}
          <span style={{ color: "var(--accent-secondary)", fontWeight: 700 }}>ShareRing</span>
        </p>
      </div>
    </div>
  );
}
