import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function ProtectedHostRoute({ children }) {
  const location = useLocation();
  const isHost = localStorage.getItem("isHost") === "true";
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleVerifyPassword(event) {
    event.preventDefault();

    if (!password.trim()) {
      setErrorMessage("Please enter host password.");
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage("");

      const response = await fetch(`${API_BASE_URL}/api/host/verify-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!response.ok || !data?.success || data?.token !== "host_verified") {
        setErrorMessage(data?.message || "Wrong password");
        return;
      }

      localStorage.setItem("isHost", "true");
      setPassword("");
    } catch (error) {
      setErrorMessage("Unable to verify password right now. Ensure backend is running on port 5000.");
    } finally {
      setIsVerifying(false);
    }
  }

  if (!isHost) {
    const message =
      location.state?.message || "Host access only. Please join as a student from a session link.";

    if (location.pathname === "/") {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
          <div className="w-full max-w-md rounded-xl border border-amber-400/35 bg-amber-500/10 p-5 text-center">
            <h1 className="text-2xl font-bold text-amber-200">Host Access Required</h1>
            <p className="mt-2 text-sm text-amber-100">{message}</p>

            <form onSubmit={handleVerifyPassword} className="mt-5 space-y-3 text-left">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-200">
                  Host Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter host password"
                  className="w-full rounded-lg border border-amber-300/40 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-amber-300"
                />
              </label>

              {errorMessage && (
                <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-600"
              >
                {isVerifying ? "Verifying..." : "Enter Host Dashboard"}
              </button>
            </form>
          </div>
        </main>
      );
    }

    return (
      <Navigate
        to="/"
        replace
        state={{ message: "Host access required. Redirected to home." }}
      />
    );
  }

  return children;
}
