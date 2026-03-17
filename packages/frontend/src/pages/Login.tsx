import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setToken } from "../lib/auth";

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
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          MeModule Developer
        </h1>
        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          {loading ? "Signing in..." : "Sign in with ShareRing"}
        </button>
      </div>
    </div>
  );
}
