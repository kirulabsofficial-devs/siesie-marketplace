import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowUpRight, Check, CheckCheck, MessageCircle, Phone, Plus, Search, Send, Video } from "lucide-react";
import { Avatar, Dialog } from "../components/ui";
import { useDb } from "../data/store";
import { markConversationRead, MESSAGE_LIMIT, refreshChat, sendMessage, startConversation, unreadIn, useActiveConversation, useChatState, useConversations, type Conversation } from "../data/chat";
import { cn } from "../lib/cn";
import { LIVE_BACKEND, STATIC_PROTOTYPE } from "../data/runtime";
import { startCall, useCallState } from "../data/calls";

const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const date = (value: string) => new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

export function Messages() {
  const db = useDb((d) => d);
  const session = db.session!;
  const customer = session.role === "customer";
  const base = customer ? "/messages" : "/work/messages";
  const { id } = useParams();
  useActiveConversation(id);
  const { contacts, loading, error: connectionError } = useChatState();
  const [params] = useSearchParams();
  const target = params.get("to");
  const navigate = useNavigate();
  const conversations = useConversations();
  const conversation = conversations.find((c) => c.id === id);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    // Mobile keyboards can shrink the visual viewport without changing 100dvh.
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport?.scale === 1) document.documentElement.style.setProperty("--messages-height", `${viewport.height}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--messages-height");
    };
  }, []);
  const peerFor = (c: Conversation) => c.peer;
  const peer = conversation && peerFor(conversation);
  const [opening, setOpening] = useState(false);
  const open = async (peerId: string) => {
    if (opening) return;
    setOpening(true);
    try { const next = await startConversation(peerId); setPicking(false); setError(""); navigate(`${base}/${next}`, { replace: !!target }); }
    catch (e) { setError((e as Error).message); }
    finally { setOpening(false); }
  };

  useEffect(() => {
    let cancelled = false;
    if (target) void startConversation(target).then((next) => { if (!cancelled) navigate(base + "/" + next, { replace: true }); }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [target, base, navigate, session.userId]);

  return <div className={cn("messages-page", id && "has-conversation")}>
    <aside className="chat-sidebar" aria-label="Conversations">
      <div className="chat-list-heading">
        <div><p className="chat-eyebrow">GOOD WORK STARTS HERE</p><h1>Messages<span>.</span></h1></div>
        <button className="chat-icon-button chat-new" onClick={() => { setError(""); setPicking(true); }} aria-label="New conversation"><Plus size={21} /></button>
      </div>
      <label className="chat-search"><Search size={17} aria-hidden /><input aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      {error && !picking && <p className="chat-error" role="alert">{error}</p>}
      {connectionError && <p className="chat-error" role="alert">{connectionError} <button className="underline" onClick={() => void refreshChat(true)}>Try again</button></p>}
      {loading && <p className="chat-no-results" role="status">Opening your inbox…</p>}
      <div className="chat-list">
        {conversations.filter((c) => peerFor(c)?.name.toLowerCase().includes(search.toLowerCase())).map((c) => {
          const person = peerFor(c);
          const last = c.lastMessage;
          const unread = unreadIn(c, session.userId);
          return <Link key={c.id} to={`${base}/${c.id}`} className={cn("chat-list-item", c.id === id && "selected")} aria-current={c.id === id ? "page" : undefined}>
            <Avatar name={person?.name || "Member"} size="sm" />
            <span className="chat-list-copy"><span className="chat-list-name">{person?.name || "Member"}</span><span className="chat-preview">{last ? `${last.senderId === session.userId ? "You: " : ""}${last.body}` : "Say hello and discuss the details"}</span></span>
            <span className="chat-list-meta"><time dateTime={last?.createdAt || c.createdAt}>{last ? new Date(last.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "New"}</time>{unread > 0 && <span className="chat-unread">{unread}<span className="sr-only"> unread messages</span></span>}</span>
          </Link>;
        })}
        {!loading && !conversations.length && <div className="chat-list-empty"><MessageCircle size={30} strokeWidth={1.4} aria-hidden /><h2>A little hello. A great start.</h2><p>{customer ? "Ask a pro about your project, availability or the details." : "Keep your customers in the loop, from first question to finished job."}</p><button onClick={() => setPicking(true)}>Start a conversation <ArrowUpRight size={16} aria-hidden /></button></div>}
        {!!conversations.length && !conversations.some((c) => peerFor(c)?.name.toLowerCase().includes(search.toLowerCase())) && <p className="chat-no-results">No conversations match “{search}”.</p>}
      </div>
      <div className="chat-local-note"><span className="prototype-dot" />{connectionError ? "Reconnecting…" : STATIC_PROTOTYPE ? "Demo messages · saved in this browser" : "Private conversation · shared across sessions"}</div>
    </aside>

    {conversation && peer ? <ConversationView key={`${session.userId}:${conversation.id}`} conversation={conversation} peer={peer} base={base} customer={customer} userId={session.userId} /> :
      <section className="chat-welcome" aria-label="Message workspace">
        {id && <Link to={base} className="message-link"><ArrowLeft size={17} />All messages</Link>}
        <div className="chat-welcome-icon"><MessageCircle size={48} strokeWidth={1.25} aria-hidden /></div>
        <p className="chat-eyebrow">LET’S TALK ABOUT THE DETAILS</p>
        <h2>{id ? "Conversation unavailable" : <>A conversation away<br />from a job well done.</>}</h2>
        <p>{id ? "This conversation isn’t available to your account. Choose a conversation or start a new one." : "Questions, plans and progress. Keep everything in one place with your " + (customer ? "pro." : "customer.")}</p>
        <button className="message-link" onClick={() => setPicking(true)}><Plus size={17} />New conversation</button>
      </section>}

    <Dialog open={picking} onClose={() => setPicking(false)} title={customer ? "Message a pro" : "Message a customer"}>
      <p className="mb-4 text-sm text-ink-soft">{customer ? "Find your pro and get the conversation started." : "Choose a customer from your jobs."}</p>
      <label className="chat-search"><Search size={17} aria-hidden /><input aria-label="Search contacts" placeholder="Search by name" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} /></label>
      {error && <p role="alert" className="chat-error">{error}</p>}
      <div className="chat-contacts">
        {contacts.filter((p) => p.name.toLowerCase().includes(contactSearch.toLowerCase())).map((p) => <button key={p.id} disabled={opening} onClick={() => void open(p.id)}>
          <Avatar name={p.name} size="sm" /><span><strong>{p.name}</strong><small>{p.services.length ? p.services.join(" · ") : p.area}</small></span><ArrowUpRight size={17} aria-hidden />
        </button>)}
        {!contacts.some((p) => p.name.toLowerCase().includes(contactSearch.toLowerCase())) && <p className="chat-no-results">{contacts.length ? "No matching contacts." : "Your customers will appear here when you receive a job request."}</p>}
      </div>
    </Dialog>
  </div>;
}

function ConversationView({ conversation, peer, base, customer, userId }: {
  conversation: Conversation; peer: { id: string; name: string }; base: string; customer: boolean; userId: string;
}) {
  const callState = useCallState();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const pendingSend = useRef<{ body: string; key: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const unread = unreadIn(conversation, userId);
  const latestMessage = conversation.messages.at(-1)?.id;
  useEffect(() => {
    const read = () => {
      if (unread && latestMessage && nearBottom.current && document.visibilityState === "visible" && document.hasFocus()) {
        void markConversationRead(conversation.id, latestMessage).catch((e: Error) => setError(e.message));
      }
    };
    read();
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    const element = log.current;
    element?.addEventListener("scrollend", read);
    return () => { window.removeEventListener("focus", read); document.removeEventListener("visibilitychange", read); element?.removeEventListener("scrollend", read); };
  }, [conversation.id, unread, latestMessage]);
  useEffect(() => {
    if (nearBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [conversation.messages.length]);
  const submit = async () => {
    if (sending || !body.trim()) return;
    setSending(true);
    if (pendingSend.current?.body !== body) pendingSend.current = { body, key: crypto.randomUUID() };
    try { await sendMessage(conversation.id, body, pendingSend.current.key); setBody(""); pendingSend.current = null; setError(""); nearBottom.current = true; input.current?.focus(); }
    catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  };
  return <section className="chat-thread" aria-label={`Conversation with ${peer.name}`}>
    <header className="chat-thread-header">
      <Link to={base} className="chat-icon-button chat-back" aria-label="Back to messages"><ArrowLeft size={20} /></Link>
      <Avatar name={peer.name} size="sm" /><div className="chat-peer"><h2>{peer.name}</h2><p>{customer ? "Your service pro" : "Your customer"}</p></div>
      {LIVE_BACKEND && <div className="chat-call-buttons" aria-label="Call this person">
        <button className="chat-icon-button" disabled={!!callState.call || callState.busy} onClick={() => void startCall(conversation.id, "voice")} aria-label={`Voice call ${peer.name}`} title="Voice call"><Phone size={20} /></button>
        <button className="chat-icon-button" disabled={!!callState.call || callState.busy} onClick={() => void startCall(conversation.id, "video")} aria-label={`Video call ${peer.name}`} title="Video call"><Video size={21} /></button>
      </div>}
      <Link className="chat-profile-link" to={customer ? `/workers/${peer.id}` : "/work/jobs"}>{customer ? "View profile" : "Your jobs"}<ArrowUpRight size={15} aria-hidden /></Link>
    </header>
    <div className="chat-log" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions" ref={log} onScroll={() => {
      const el = log.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    }}>
      {!conversation.messages.length && <div className="chat-thread-empty"><MessageCircle size={28} strokeWidth={1.5} aria-hidden /><p>Say hello to {peer.name.split(" ")[0]}.</p><span>{customer ? "Share what you have in mind for your project." : "Ask about the job or share a quick update."}</span></div>}
      {conversation.messages.map((m, i) => {
        const own = m.senderId === userId;
        const day = date(m.createdAt);
        return <div key={m.id}>
          {(i === 0 || date(conversation.messages[i - 1].createdAt) !== day) && <div className="chat-day">{day}</div>}
          <article className={cn("chat-message", own && "outgoing")} aria-label={`${own ? "You" : peer.name}, ${time(m.createdAt)}`}>
            <p>{m.body}</p><div className="chat-message-meta"><time dateTime={m.createdAt}>{time(m.createdAt)}</time>{own && <span>{m.readAt ? <CheckCheck size={13} aria-hidden /> : <Check size={13} aria-hidden />}{m.readAt ? "Read" : "Sent"}</span>}</div>
          </article>
        </div>;
      })}
    </div>
    <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <div className="chat-input-row"><textarea ref={input} disabled={sending} aria-label="Write a message" placeholder={`Message ${peer.name.split(" ")[0]}…`} value={body} maxLength={MESSAGE_LIMIT} rows={2} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (body.trim()) submit(); }
      }} /><button type="submit" disabled={sending || !body.trim()} aria-label="Send message"><Send size={19} aria-hidden /></button></div>
      <div className="chat-composer-hint"><span>Enter to send · Shift + Enter for a new line</span><span>{body.length}/{MESSAGE_LIMIT}</span></div>
    </form>
  </section>;
}
