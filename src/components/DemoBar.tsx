import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, BriefcaseBusiness, LogOut, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import type { Role } from "../data/types";
import { DEMO_USERS } from "../data/seed";
import { refreshSession, resetDemo, signIn, signOut, useDb, useSessionState } from "../data/store";
import { useToast } from "./Toast";
import { LIVE_BACKEND, STATIC_PROTOTYPE } from "../data/runtime";
import { Dialog } from "./ui";
import { ThemeSwitcher } from "./ThemeSwitcher";

const HOME: Record<Role, string> = { customer: "/jobs", worker: "/work", admin: "/admin" };
const roles = [
  { role: "customer" as const, label: "Customer", who: "Ama", icon: UserRound, description: "Find your pro. Make a plan. Enjoy your home." },
  { role: "worker" as const, label: "Pro", who: "Kwame", icon: BriefcaseBusiness, description: "Meet your customers and manage your work." },
  { role: "admin" as const, label: "Admin", who: "Adjoa", icon: ShieldCheck, description: "Keep an eye on bookings, reviews and payouts." },
];
export function DemoBar() {
  const session = useDb((d) => d.session);
  const { ready, pending, testMode, error } = useSessionState();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const enter = async (role: Role) => {
    try { await signIn(role, DEMO_USERS[role]); setOpen(false); navigate(HOME[role]); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  if (LIVE_BACKEND) return error ? <div className="prototype-connection" role="alert">{error}<button onClick={() => void refreshSession()}>Retry</button></div> : null;
  if (!testMode && ready) return null;
  return <>
    <div className="demo-strip prototype-bar">
      <div className="prototype-bar-inner">
        <span className="prototype-caption"><span className="prototype-dot" />{session ? `Prototype · ${roles.find((r) => r.role === session.role)?.label} view` : "Take a look around"}<span className="prototype-caption-detail">{STATIC_PROTOTYPE ? "Demo only · saved in this browser." : session ? "Sample accounts. No real payments." : "A little preview of life, sorted."}</span></span>
        <div className="prototype-actions">
          {session ? <>
            <button className="prototype-switch" onClick={() => setOpen(true)} disabled={pending}>Switch view <ArrowUpRight size={14} /></button>
            <button className="prototype-icon" aria-label="Reset local demo journeys" title="Reset local demo journeys" onClick={() => { if (confirm("Reset bookings and profiles in this browser? Messages and your session will be kept.")) { resetDemo(); navigate(HOME[session.role]); toast("Local demo journeys reset. Messages kept."); } }}><RotateCcw size={15} /></button>
            <button className="prototype-icon" aria-label="Log out of prototype" title="Log out" disabled={pending} onClick={() => void signOut()}><LogOut size={15} /></button>
            <ThemeSwitcher />
          </> : <><span className="prototype-view-label">View prototype as</span>{roles.map((r) => <button key={r.role} aria-label={`View prototype as ${r.label.toLowerCase()}`} disabled={!ready || pending} onClick={() => void enter(r.role)}>{r.label}<ArrowUpRight size={12} aria-hidden /></button>)}<ThemeSwitcher /></>}
        </div>
      </div>
      {error && <div className="prototype-connection" role="alert">{error}<button onClick={() => void refreshSession()}>Retry</button></div>}
    </div>
    <Dialog open={open} onClose={() => setOpen(false)} title="Explore another side of Siesie">
      <p className="prototype-dialog-intro">Choose a sample account to step inside.</p>
      <div className="prototype-role-list">{roles.map((r) => <button key={r.role} disabled={pending} aria-label={`View prototype as ${r.label.toLowerCase()}`} onClick={() => void enter(r.role)}><r.icon size={22} strokeWidth={1.5} /><span><strong>{r.label} <small>· {r.who}</small></strong><span>{r.description}</span></span><ArrowUpRight size={18} /></button>)}</div>
      <p className="prototype-dialog-note">{STATIC_PROTOTYPE ? "Switch between customer and pro to try messaging in this browser. Accounts and messages stay on this device; use sample details." : "Messages are shared between demo accounts. Use sample details while exploring."}</p>
    </Dialog>
  </>;
}
