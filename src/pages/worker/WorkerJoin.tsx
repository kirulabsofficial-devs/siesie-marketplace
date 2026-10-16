import { Navigate, useNavigate } from "react-router";
import { WorkerProfileForm } from "../../components/WorkerProfileForm";
import { PageHeader } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { registerWorker, useDb, useSessionState } from "../../data/store";
import { LIVE_BACKEND } from "../../data/runtime";
import { useTitle } from "../../lib/hooks";

export function WorkerJoin() {
  useTitle("Register as a worker · Siesie");
  const navigate = useNavigate();
  const toast = useToast();
  const session = useDb((d) => d.session);
  const { ready } = useSessionState();
  if (LIVE_BACKEND && !ready) return <p className="session-loading">Opening your account…</p>;
  if (LIVE_BACKEND && session?.role !== "worker") return <Navigate to="/login?as=worker&next=/join" replace />;
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
    <PageHeader title="Put your skills to work" lead="Tell us what you do, where you work and how you want to be paid. Agree the price before starting each job." />
    <WorkerProfileForm onSave={async (value) => { try { await registerWorker(value); toast("Application received. Your identity review is pending."); navigate("/work"); } catch (e) { toast((e as Error).message, "error"); } }} />
  </div>;
}
