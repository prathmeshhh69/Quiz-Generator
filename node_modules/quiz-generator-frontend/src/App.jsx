import { BrowserRouter, Route, Routes } from "react-router-dom";
import HostDashboard from "./pages/HostDashboard";
import HostLive from "./pages/HostLive";
import StudentJoin from "./pages/Studentjoin";
import StudentQuiz from "./pages/StudentQuiz";
import Leaderboard from "./pages/Leaderboard";
import ProtectedHostRoute from "./components/ProtectedHostRoute";

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-slate-300">Page not found.</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={(
            <ProtectedHostRoute>
              <HostDashboard />
            </ProtectedHostRoute>
          )}
        />
        <Route
          path="/host/:sessionCode"
          element={(
            <ProtectedHostRoute>
              <HostLive />
            </ProtectedHostRoute>
          )}
        />
        <Route path="/join/:sessionCode" element={<StudentJoin />} />
        <Route path="/quiz/:sessionCode" element={<StudentQuiz />} />
        <Route path="/leaderboard/:sessionCode" element={<Leaderboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
