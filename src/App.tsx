import { useEffect, type ReactNode } from "react";
import { createBrowserRouter, createHashRouter, Navigate, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { Role } from "./data/types";
import { clearLiveState, getDb, refreshSession, sweepExpiredWindows, useDb, useSessionState } from "./data/store";
import { supabase } from "./data/supabase";
import { ToastProvider } from "./components/Toast";
import { CallOverlay } from "./components/CallOverlay";
import { startChatSync } from "./data/chat";
import { PublicLayout } from "./layouts/PublicLayout";
import { WorkerLayout } from "./layouts/WorkerLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { Landing } from "./pages/Landing";
import { Search } from "./pages/Search";
import { WorkerProfile } from "./pages/WorkerProfile";
import { BookingRequest } from "./pages/BookingRequest";
import { Login } from "./pages/Login";
import { Messages } from "./pages/Messages";
import { NotFound } from "./pages/NotFound";
import { CustomerJobs } from "./pages/customer/CustomerJobs";
import { CustomerJob } from "./pages/customer/CustomerJob";
import { WorkerJoin } from "./pages/worker/WorkerJoin";
import { WorkerRequests } from "./pages/worker/WorkerRequests";
import { WorkerJobs } from "./pages/worker/WorkerJobs";
import { WorkerJob } from "./pages/worker/WorkerJob";
import { WorkerEarnings } from "./pages/worker/WorkerEarnings";
import { WorkerSettings } from "./pages/worker/WorkerSettings";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { AdminVerifications } from "./pages/admin/AdminVerifications";
import { AdminPayouts } from "./pages/admin/AdminPayouts";
import { AdminDisputes } from "./pages/admin/AdminDisputes";
import { AdminDispute } from "./pages/admin/AdminDispute";
import { AdminTransactions } from "./pages/admin/AdminTransactions";
import { AdminSettings } from "./pages/admin/AdminSettings";

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const session = useDb((d) => d.session);
  const { ready, error } = useSessionState();
  const { pathname, search } = useLocation();
  if (!ready) return <div className="session-loading" role="status">Opening your workspace…</div>;
  if (error && !session) return <div className="session-loading" role="alert">{error}<button className="message-link" onClick={() => void refreshSession()}>Try again</button></div>;
  if (session?.role !== role) {
    return <Navigate to={`/login?as=${role}&next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <>{children}</>;
}

/*
 * A browser router assumes the app owns the whole path. When the build is
 * served from a sub-path — a static preview host, a shared demo link — it would
 * try to match that host's path against these routes and land on NotFound.
 * Demo builds opt into a hash router, which is immune to where it is mounted.
 */
const createRouter = import.meta.env.VITE_HASH_ROUTER === "1" ? createHashRouter : createBrowserRouter;

const router = createRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/search", element: <Search /> },
      { path: "/workers/:id", element: <WorkerProfile /> },
      { path: "/login", element: <Login /> },
      { path: "/join", element: <WorkerJoin /> },
      { path: "/messages", element: <RequireRole role="customer"><Messages /></RequireRole> },
      { path: "/messages/:id", element: <RequireRole role="customer"><Messages /></RequireRole> },
      {
        path: "/book/:workerId",
        element: (
          <RequireRole role="customer">
            <BookingRequest />
          </RequireRole>
        ),
      },
      {
        path: "/jobs",
        element: (
          <RequireRole role="customer">
            <CustomerJobs />
          </RequireRole>
        ),
      },
      {
        path: "/jobs/:id",
        element: (
          <RequireRole role="customer">
            <CustomerJob />
          </RequireRole>
        ),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/work",
    element: (
      <RequireRole role="worker">
        <WorkerLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <WorkerRequests /> },
      { path: "jobs", element: <WorkerJobs /> },
      { path: "jobs/:id", element: <WorkerJob /> },
      { path: "earnings", element: <WorkerEarnings /> },
      { path: "profile", element: <WorkerSettings /> },
      { path: "messages", element: <Messages /> },
      { path: "messages/:id", element: <Messages /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <RequireRole role="admin">
        <AdminLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "verifications", element: <AdminVerifications /> },
      { path: "payouts", element: <AdminPayouts /> },
      { path: "disputes", element: <AdminDisputes /> },
      { path: "disputes/:id", element: <AdminDispute /> },
      { path: "transactions", element: <AdminTransactions /> },
      { path: "settings", element: <AdminSettings /> },
    ],
  },
]);

export function App() {
  useEffect(() => {
    const auth = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && getDb().session?.userId !== session?.user.id)) clearLiveState();
      // Supabase auth callbacks must finish before making another auth request.
      setTimeout(() => void refreshSession(), 0);
    });
    const stopChat = startChatSync();
    void refreshSession();
    const refresh = () => { if (document.visibilityState === "visible") void refreshSession(); };
    const logout = () => { void router.navigate("/", { replace: true, flushSync: true }); };
    window.addEventListener("focus", refresh);
    window.addEventListener("siesie:logout", logout);
    const sessionTimer = setInterval(refresh, 20_000);
    sweepExpiredWindows();
    const t = setInterval(sweepExpiredWindows, 60_000);
    return () => { auth?.data.subscription.unsubscribe(); stopChat(); clearInterval(t); clearInterval(sessionTimer); window.removeEventListener("focus", refresh); window.removeEventListener("siesie:logout", logout); };
  }, []);

  return (
    <ToastProvider>
      <RouterProvider router={router} />
      <CallOverlay />
    </ToastProvider>
  );
}
