import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AREAS } from "../config";
import { requireSupabase } from "../data/supabase";
import { getDb, refreshSession } from "../data/store";
import { Button, Field, Tile } from "../components/ui";
import { useTitle } from "../lib/hooks";

export function LiveLogin() {
  useTitle("Your account · Siesie");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = params.get("as") === "worker" ? "worker" : "customer";
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(params.get("reset") === "1" ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = requireSupabase();
      if (mode === "forgot") {
        const result = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login?reset=1` });
        if (result.error) throw result.error;
        setNotice("If an account exists for this email, a password reset link is on its way."); return;
      }
      if (mode === "reset") {
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
      } else if (mode === "signup") {
        if (name.trim().length < 2 || !area || !/^0[235]\d{8}$/.test(phone.replace(/\D/g, ""))) throw new Error("Add your name, area and a valid Ghana mobile number.");
        const result = await client.auth.signUp({ email: email.trim(), password, options: {
          emailRedirectTo: `${window.location.origin}/login?as=${role}${role === "worker" ? "&next=/join" : ""}`,
          data: { name: name.trim(), phone: phone.replace(/\D/g, ""), area, role },
        } });
        if (result.error) throw result.error;
        if (!result.data.session) { setNotice("Check your email to confirm your account, then return here to log in."); setMode("login"); setPassword(""); return; }
      } else {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
      }
      await refreshSession();
      const account = getDb().session;
      if (!account) throw new Error("Your account could not be loaded. Please try again.");
      const requested = params.get("next");
      const safeNext = requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") && !requested.startsWith("/login") ? requested : null;
      const worker = getDb().workers.find((item) => item.id === account.userId);
      navigate(account.role === "worker" && worker?.verification === "not_submitted" ? "/join" :
        safeNext && account.role === role ? safeNext : account.role === "worker" ? "/work" : account.role === "admin" ? "/admin" : "/jobs", { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
    <Link to="/" className="mb-5 inline-block font-bold text-cobalt">← Back to Siesie</Link>
    <Tile className="p-6 sm:p-8">
      <h1 className="display text-3xl">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Welcome back"}</h1>
      <p className="mt-3 text-ink-soft">{role === "worker" ? "Connect with customers and manage your work." : "Book trusted professionals and keep track of your jobs."}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        {mode !== "reset" && <Field label="Email address">{(p) => <input {...p} className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>}
        {mode !== "forgot" && <Field label="Password" hint={mode !== "login" ? "Use at least 10 characters." : undefined}>{(p) => <input {...p} className="field" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 10} required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>}
        {mode === "signup" && <>
          <Field label="Your name">{(p) => <input {...p} className="field" autoComplete="name" minLength={2} maxLength={100} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Phone number">{(p) => <input {...p} className="field" type="tel" autoComplete="tel" placeholder="024 412 3456" required value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
          <Field label="Your area">{(p) => <select {...p} className="field" required value={area} onChange={(e) => setArea(e.target.value)}><option value="">Choose an area</option>{AREAS.map((item) => <option key={item}>{item}</option>)}</select>}</Field>
        </>}
        {error && <p role="alert" className="rounded-xl bg-kiln-wash p-3 text-sm text-kiln-deep">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-cobalt-wash p-3 text-sm text-cobalt">{notice}</p>}
        <Button type="submit" size="lg" busy={busy}>{mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Save password" : "Log in"}</Button>
      </form>
      <div className="mt-5 flex flex-col items-start gap-3 text-sm font-bold text-cobalt">
        <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setNotice(""); }}>{mode === "signup" ? "Already have an account? Log in" : "New to Siesie? Create an account"}</button>
        {mode === "login" && <button onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>Forgot your password?</button>}
        <Link to={role === "worker" ? "/login?as=customer" : "/login?as=worker&next=/join"}>{role === "worker" ? "Looking to hire? Customer accounts" : "Offering a service? Professional accounts"}</Link>
      </div>
      <p className="mt-6 border-t border-grout pt-4 text-center text-xs text-ink-faint">
        By continuing, you agree to our{" "}
        <Link to="/terms" className="font-bold text-cobalt hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="font-bold text-cobalt hover:underline">
          Privacy Policy
        </Link>.
      </p>
    </Tile>
  </div>;
}
