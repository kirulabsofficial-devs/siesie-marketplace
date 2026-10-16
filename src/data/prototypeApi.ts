/** Browser-only demo transport for the explicitly selected static prototype build.
 * These accounts and messages are simulations, never production authentication.
 * Its own storage key keeps it separate from server sessions and booking data.
 */
import fixture from "../../server/seed.json";
import { ApiError } from "./api";
import type { ChatMessage, Contact } from "./chat";
import type { Role, ServiceId, Session } from "./types";

const KEY = "siesie.static-prototype.v1";
const TTL = 7 * 24 * 60 * 60 * 1000;
type User = Contact & { role: Role; phone: string; joinedAt: string; verified: boolean };
type Message = ChatMessage & { clientId: string };
type Conversation = {
  id: string; customerId: string; workerId: string; createdAt: string;
  messages: Message[]; cursors: Record<string, { sequence: number; at: string }>;
};
interface State {
  version: 1;
  users: User[];
  session: (Session & { expiresAt: number }) | null;
  conversations: Conversation[];
  sequence: number;
}
const fresh = (): State => ({
  version: 1, users: fixture.users.map((user) => ({ ...user, role: user.role as Role, services: user.services || [], verified: user.verified || false })),
  session: null, conversations: [], sequence: 0,
});
let memory = fresh();
const fail = (status: number, message: string): never => { throw new ApiError(message, status); };
const now = () => new Date().toISOString();
const normalizePhone = (phone: string) => phone.replace(/\D/g, "").replace(/^233/, "0");
function text(value: unknown, name: string, max = 100): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) return fail(400, `Enter a valid ${name} (1–${max} characters).`);
  return value.trim();
}
function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) memory = fresh();
    else {
      const saved = JSON.parse(raw) as State;
      if (saved.version === 1 && Array.isArray(saved.users) && Array.isArray(saved.conversations) && Number.isSafeInteger(saved.sequence)) memory = saved;
      else memory = fresh();
    }
  } catch { /* A fresh guest can still browse when browser storage is blocked. */ }
  return structuredClone(memory);
}
function save(state: State) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { return fail(507, "This prototype could not save your changes. Allow browser storage or free some space, then try again."); }
  memory = state;
}
const contact = ({ id, role, name, area, services }: User): Contact => ({ id, role, name, area, services });
function currentUser(state: State) {
  const session = state.session;
  return session && session.expiresAt > Date.now() ? state.users.find((user) => user.id === session.userId && user.role === session.role) : undefined;
}
function sessionResult(user?: User) {
  return {
    session: user ? { role: user.role, userId: user.id } : null,
    user: user ? { ...contact(user), phone: user.phone, joinedAt: user.joinedAt } : null,
    testMode: true,
  };
}
function signIn(state: State, user: User) {
  state.session = { role: user.role, userId: user.id, expiresAt: Date.now() + TTL };
  save(state);
  return sessionResult(user);
}
function includesUser(conversation: Conversation, user: User) {
  return conversation.customerId === user.id || conversation.workerId === user.id;
}
function canContact(state: State, user: User, peer: User) {
  if (peer.role !== (user.role === "customer" ? "worker" : "customer")) return false;
  const customerId = user.role === "customer" ? user.id : peer.id;
  const workerId = user.role === "worker" ? user.id : peer.id;
  return (user.role === "customer" && peer.verified)
    || fixture.memberships.some((job) => job.customerId === customerId && job.workerId === workerId)
    || state.conversations.some((conversation) => conversation.customerId === customerId && conversation.workerId === workerId);
}
function view(state: State, conversation: Conversation, user: User) {
  const peerId = user.id === conversation.customerId ? conversation.workerId : conversation.customerId;
  const peer = state.users.find((person) => person.id === peerId);
  if (!peer) return fail(404, "Contact unavailable.");
  const cursor = conversation.cursors[user.id];
  const peerCursor = conversation.cursors[peerId];
  return {
    id: conversation.id, customerId: conversation.customerId, workerId: conversation.workerId, createdAt: conversation.createdAt,
    peer: contact(peer), lastMessage: conversation.messages.at(-1) || null,
    unreadCount: conversation.messages.filter((message) => message.senderId !== user.id && message.sequence > (cursor?.sequence || 0)).length,
    readCursor: cursor?.sequence || 0, peerReadCursor: peerCursor?.sequence || 0, peerReadAt: peerCursor?.at || null,
  };
}
function handle(path: string, data?: unknown): unknown {
  const state = load();
  const url = new URL(path, "https://prototype.invalid");
  const route = url.pathname;
  const input = (data || {}) as Record<string, unknown>;
  const writing = data !== undefined;
  if (route === "/health" && !writing) return { ok: true, testMode: true };
  if (route === "/session" && !writing) return sessionResult(currentUser(state));
  if (route === "/session/logout" && writing) { state.session = null; save(state); return { ok: true }; }
  if (route === "/test/session" && writing) {
    const user = state.users.find((person) => person.id === input.userId && person.role === input.role);
    if (!user) return fail(401, "Account not found.");
    return signIn(state, user);
  }
  if (route === "/test/login" && writing) {
    if (input.code !== "123456") return fail(401, "The demo code is 123456.");
    const phone = normalizePhone(text(input.phone, "phone"));
    const user = state.users.find((person) => normalizePhone(person.phone) === phone);
    return user ? signIn(state, user) : { needsRegistration: true };
  }
  if (route === "/test/register" && writing) {
    if ((input.role !== "customer" && input.role !== "worker") || input.code !== "123456") return fail(400, "Choose a customer or pro demo account.");
    const phone = normalizePhone(text(input.phone, "phone"));
    if (!/^0\d{9}$/.test(phone)) return fail(400, "Enter a 10-digit phone number.");
    if (state.users.some((person) => normalizePhone(person.phone) === phone)) return fail(409, "This phone number already has an account. Log in instead.");
    const services = input.services || [];
    if (!Array.isArray(services) || services.length > 3 || services.some((service) => !["tiling", "cleaning", "maintenance"].includes(service))) return fail(400, "Invalid services.");
    const user: User = {
      id: `${input.role === "customer" ? "c" : "w"}_${crypto.randomUUID()}`, role: input.role,
      name: text(input.name, "name"), phone, area: text(input.area, "area"),
      services: services as ServiceId[], joinedAt: now(), verified: false,
    };
    state.users.push(user);
    return signIn(state, user);
  }
  const user = currentUser(state);
  if (!user) return fail(401, "Your session has ended. Choose a prototype account to continue.");
  if (user.role === "admin") return fail(403, "Messaging is available to customers and pros.");
  if (route === "/contacts" && !writing) return {
    userId: user.id, contacts: state.users.filter((peer) => canContact(state, user, peer)).sort((a, b) => a.name.localeCompare(b.name)).map(contact),
  };
  if (route === "/conversations" && !writing) return {
    userId: user.id, conversations: state.conversations.filter((conversation) => includesUser(conversation, user))
      .map((conversation) => view(state, conversation, user))
      .sort((a, b) => (b.lastMessage?.sequence || 0) - (a.lastMessage?.sequence || 0) || b.createdAt.localeCompare(a.createdAt)),
  };
  if (route === "/conversations" && writing) {
    const peer = state.users.find((person) => person.id === input.peerId);
    if (!peer || !canContact(state, user, peer)) return fail(403, "You cannot start a conversation with this account.");
    const customerId = user.role === "customer" ? user.id : peer.id;
    const workerId = user.role === "worker" ? user.id : peer.id;
    let conversation = state.conversations.find((item) => item.customerId === customerId && item.workerId === workerId);
    if (!conversation) {
      conversation = { id: crypto.randomUUID(), customerId, workerId, createdAt: now(), messages: [], cursors: {} };
      state.conversations.push(conversation);
      save(state);
    }
    return { conversation: view(state, conversation, user) };
  }
  const match = route.match(/^\/conversations\/([a-zA-Z0-9_-]+)(?:\/(messages|read))?$/);
  if (!match) return fail(404, "Page unavailable.");
  const conversation = state.conversations.find((item) => item.id === match[1] && includesUser(item, user));
  if (!conversation) return fail(404, "Conversation unavailable.");
  if (!match[2] && !writing) return { conversation: view(state, conversation, user) };
  if (match[2] === "messages" && !writing) {
    const after = Number(url.searchParams.get("after") || 0);
    const limit = Number(url.searchParams.get("limit") || 100);
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return fail(400, "Invalid message cursor or page size.");
    const remaining = conversation.messages.filter((message) => message.sequence > after);
    const messages = remaining.slice(0, limit);
    return { messages, hasMore: remaining.length > limit, nextCursor: messages.at(-1)?.sequence || after };
  }
  if (match[2] === "messages" && writing) {
    const body = text(input.body, "message", 2000);
    const clientId = text(input.clientId, "message key");
    const existing = conversation.messages.find((message) => message.senderId === user.id && message.clientId === clientId);
    if (existing) {
      if (existing.body !== body) return fail(409, "This message key was already used.");
      return { message: existing };
    }
    const message: Message = { id: crypto.randomUUID(), sequence: ++state.sequence, senderId: user.id, body, clientId, createdAt: now() };
    conversation.messages.push(message);
    save(state);
    return { message };
  }
  if (match[2] === "read" && writing) {
    const message = conversation.messages.find((item) => item.id === input.messageId);
    if (!message) return fail(400, "Read cursor must refer to a message in this conversation.");
    if (message.sequence > (conversation.cursors[user.id]?.sequence || 0)) {
      conversation.cursors[user.id] = { sequence: message.sequence, at: now() };
      save(state);
    }
    return { conversation: view(state, conversation, user) };
  }
  return fail(405, "Action unavailable.");
}

export async function prototypeApi<T>(path: string, data?: unknown): Promise<T> {
  try {
    // Serialize requests from tabs in the same browser so simultaneous writes
    // do not overwrite each other's messages or account changes.
    const request = () => structuredClone(handle(path, data)) as T;
    return await (navigator.locks ? navigator.locks.request(KEY, request) : request());
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !path.startsWith("/test/")) window.dispatchEvent(new Event("siesie:session-expired"));
    throw error;
  }
}
