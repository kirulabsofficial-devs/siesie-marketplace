import { useEffect, useSyncExternalStore } from "react";
import { getDb, refreshSession } from "./store";
import type { Role, Session } from "./types";
import { api } from "./api";

export interface ChatMessage { id: string; sequence: number; senderId: string; body: string; createdAt: string; readAt?: string }
export interface Contact { id: string; role: Role; name: string; area: string; services: string[] }
export interface Conversation {
  id: string; customerId: string; workerId: string; createdAt: string; peer: Contact;
  messages: ChatMessage[]; lastMessage: ChatMessage | null; unreadCount: number;
  readCursor: number; peerReadCursor: number; peerReadAt: string | null;
}
export const MESSAGE_LIMIT = 2000;
let state = { conversations: [] as Conversation[], contacts: [] as Contact[], loading: true, error: "" };
let generation = 0;
let activeId: string | undefined;
let flight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => state;
function reset() {
  generation++;
  activeId = undefined;
  state = { conversations: [], contacts: [], loading: true, error: "" };
  emit();
}
window.addEventListener("siesie:account-changed", () => { reset(); void refreshChat(true); });

export function belongsTo(c: Conversation, session: Session | null) {
  return !!session && ((session.role === "customer" && c.customerId === session.userId) || (session.role === "worker" && c.workerId === session.userId));
}
export const unreadIn = (c: Conversation, _userId: string) => c.unreadCount;
export const useChatState = () => useSyncExternalStore(subscribe, snapshot);
export function useConversations() { return useChatState().conversations; }
export function useUnreadChats() { return useConversations().reduce((count, c) => count + c.unreadCount, 0); }
export function useActiveConversation(id?: string) {
  useEffect(() => {
    activeId = id;
    void refreshChat(true);
    return () => { if (activeId === id) activeId = undefined; };
  }, [id]);
}
export function startChatSync() {
  const refresh = () => { if (document.visibilityState === "visible") void refreshChat(); };
  refresh();
  const timer = setInterval(refresh, 2000);
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
}
export async function refreshChat(force = false): Promise<void> {
  if (flight) { if (!force) return flight; await flight; }
  const session = getDb().session;
  if (!session || session.role === "admin") { state = { conversations: [], contacts: [], loading: false, error: "" }; emit(); return; }
  const ownGeneration = generation;
  const thread = activeId;
  const work = async () => {
    try {
      const [list, contacts] = await Promise.all([
        api<{ userId: string; conversations: Conversation[] }>("/conversations"), api<{ userId: string; contacts: Contact[] }>("/contacts"),
      ]);
      if (ownGeneration !== generation) return;
      // Tabs in one browser share a cookie. Reconcile identity before displaying another account's response.
      if (list.userId !== session.userId || contacts.userId !== session.userId) { reset(); void refreshSession(); return; }
      const next = list.conversations.map((c) => ({ ...c, messages: state.conversations.find((old) => old.id === c.id)?.messages || [] }));
      const current = next.find((c) => c.id === thread);
      if (current) {
        let after = current.messages.at(-1)?.sequence || 0;
        let hasMore = true;
        while (hasMore) {
          const page = await api<{ messages: ChatMessage[]; nextCursor: number; hasMore: boolean }>(`/conversations/${current.id}/messages?after=${after}&limit=100`);
          if (ownGeneration !== generation) return;
          current.messages = [...current.messages, ...page.messages];
          after = page.nextCursor; hasMore = page.hasMore;
        }
      }
      if (ownGeneration !== generation) return;
      for (const c of next) c.messages = c.messages.map((m) => ({ ...m, readAt: m.senderId === session.userId && m.sequence <= c.peerReadCursor ? c.peerReadAt || undefined : undefined }));
      state = { conversations: next, contacts: contacts.contacts, loading: false, error: "" }; emit();
    } catch (error) {
      if (ownGeneration !== generation) return;
      state = { ...state, loading: false, error: (error as Error).message }; emit();
    }
  };
  const promise = work(); flight = promise;
  await promise;
  if (flight === promise) flight = null;
}
export async function startConversation(peerId: string) {
  const result = await api<{ conversation: Conversation }>("/conversations", { peerId });
  await refreshChat(true);
  return result.conversation.id;
}
export async function sendMessage(id: string, text: string, clientId: string) {
  const result = await api<{ message: ChatMessage }>(`/conversations/${id}/messages`, { body: text.trim(), clientId });
  await refreshChat(true);
  return result.message.id;
}
export async function markConversationRead(id: string, messageId: string) {
  await api(`/conversations/${id}/read`, { messageId });
  await refreshChat(true);
}
