import { useSyncExternalStore } from "react";
import { requireSupabase } from "./supabase";
import { rpc } from "./supabaseStore";

export type CallMode = "voice" | "video";
export interface Call {
  id: string; conversationId: string; callerId: string; calleeId: string; peerName: string;
  mode: CallMode; state: "ringing" | "accepted" | "declined" | "ended" | "missed";
  createdAt: string; acceptedAt: string | null;
}
interface Signal { sequence: number; kind: "offer" | "answer" | "candidate"; payload: RTCSessionDescriptionInit & RTCIceCandidateInit }
interface Reply { call: Call | null; signals: Signal[]; owned: boolean }
interface CallState {
  call: Call | null; busy: boolean; connected: boolean; status: string; error: string;
  local: MediaStream | null; remote: MediaStream | null; muted: boolean; cameraOff: boolean;
}
const initial = (): CallState => ({ call: null, busy: false, connected: false, status: "", error: "", local: null, remote: null, muted: false, cameraOff: false });
let state = initial();
const listeners = new Set<() => void>();
const set = (patch: Partial<CallState>) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
export const useCallState = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state);
const device = crypto.randomUUID();
let userId: string | null = null;
let generation = 0;
let pc: RTCPeerConnection | null = null;
let cursor = 0;
let queuedCandidates: RTCIceCandidateInit[] = [];
let polling = false;
let lastSuccess = Date.now();
let connectionTimer: ReturnType<typeof setTimeout> | undefined;
let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
let signalQueue = Promise.resolve();
const failures = new Set<string>();
const endedStatus = (call: Call) => call.state === "declined" ? "Call declined" : call.state === "missed" ? "No answer. Try a message instead." : "Call ended";
const active = (id: string) => state.call?.id === id;
const request = (action: string, input: Record<string, unknown> = {}) => rpc<Reply>("siesie_call", { action, input: { ...input, device } });
const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop());

function releaseMedia() {
  clearTimeout(connectionTimer); clearTimeout(disconnectTimer);
  if (pc) { pc.onicecandidate = null; pc.ontrack = null; pc.onconnectionstatechange = null; pc.close(); pc = null; }
  stopStream(state.local); stopStream(state.remote);
  cursor = 0; queuedCandidates = []; signalQueue = Promise.resolve();
}
function reset(status = "", error = "") {
  generation++; releaseMedia(); state = initial(); set({ status, error });
}
function friendly(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Allow microphone access (and camera access for video) in your browser, then try again.";
    if (error.name === "NotFoundError") return "No microphone or camera was found. Connect a device and try again.";
    if (error.name === "NotReadableError") return "Your microphone or camera is being used elsewhere. Close the other app and try again.";
  }
  return error instanceof Error ? error.message : "The call could not connect. Please try again.";
}
function endRemotely(call: Call) {
  return request(call.state === "ringing" && call.calleeId === userId ? "decline" : "end", { callId: call.id });
}
export function endCall() {
  if (!state.call && !state.busy) return;
  const call = state.call;
  if (call) void endRemotely(call).catch(() => { /* Missing heartbeats also expire disconnected calls. */ });
  reset("Call ended");
}
async function failCall(id: string, error: unknown) {
  if (!active(id) || failures.has(id)) return;
  failures.add(id);
  const version = generation;
  try {
    // A decline/hang-up can race the relay request or an outgoing ICE signal.
    // Prefer the actual terminal call state to a misleading connection error.
    const result = await request("sync", { callId: id }).catch(() => null);
    if (version !== generation || !active(id)) return;
    if (result?.call && ["declined", "ended", "missed"].includes(result.call.state)) { reset(endedStatus(result.call)); return; }
    void endRemotely(state.call!).catch(() => {});
    reset("", friendly(error));
  } finally { failures.delete(id); }
}
async function getMedia(mode: CallMode) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("Calls need an up-to-date browser and a secure HTTPS connection.");
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: mode === "video" ? { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } } : false });
}
function sendSignal(id: string, kind: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit) {
  const input = { callId: id, kind, payload, clientId: crypto.randomUUID() };
  signalQueue = signalQueue.then(async () => {
    if (!active(id)) return;
    try { await request("signal", input); }
    catch (error) {
      if (!active(id)) return;
      // A retry has the same idempotency key; an uncertain response cannot duplicate an offer.
      try { await request("signal", input); } catch { failCall(id, error); }
    }
  });
  return signalQueue;
}
async function prepare(call: Call, stream: MediaStream, version: number) {
  const { data, error } = await requireSupabase().functions.invoke("call-ice", { body: { callId: call.id, device } });
  if (version !== generation || !active(call.id)) return null;
  if (error || !Array.isArray(data?.iceServers) || !data.iceServers.length) throw new Error("Calling is temporarily unavailable. Please send a message and try again later.");
  const peer = new RTCPeerConnection({ iceServers: data.iceServers, iceTransportPolicy: "relay" });
  pc = peer;
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  const remote = new MediaStream();
  set({ remote });
  peer.ontrack = (event) => { if (active(call.id)) { remote.addTrack(event.track); set({ remote }); } };
  peer.onicecandidate = (event) => { if (event.candidate && active(call.id)) void sendSignal(call.id, "candidate", event.candidate.toJSON()); };
  peer.onconnectionstatechange = () => {
    if (!active(call.id)) return;
    if (peer.connectionState === "connected") { clearTimeout(connectionTimer); clearTimeout(disconnectTimer); set({ connected: true, status: "Connected", busy: false }); }
    else if (peer.connectionState === "failed") failCall(call.id, new Error("The call connection failed. Check your internet connection and call again."));
    else if (peer.connectionState === "disconnected") {
      set({ connected: false, status: "Reconnecting…" });
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => failCall(call.id, new Error("The connection was lost. Please call again.")), 20_000);
    }
  };
  connectionTimer = setTimeout(() => failCall(call.id, new Error("The call could not connect. Please try again.")), 75_000);
  return peer;
}
export async function startCall(conversationId: string, mode: CallMode) {
  if (!userId || state.call || state.busy) return;
  const version = ++generation;
  const id = crypto.randomUUID();
  set({ busy: true, error: "", status: "Opening your microphone…" });
  try {
    const stream = await getMedia(mode);
    if (version !== generation) { stopStream(stream); return; }
    set({ local: stream });
    const result = await request("create", { callId: id, conversationId, mode });
    if (version !== generation) { if (result.call) void request("end", { callId: id }).catch(() => {}); return; }
    if (!result.call) throw new Error("The call could not start.");
    set({ call: result.call, status: "Calling…" });
    const peer = await prepare(result.call, stream, version);
    if (!peer) return;
    const offer = await peer.createOffer();
    if (version !== generation) return;
    await peer.setLocalDescription(offer);
    if (version !== generation) return;
    await sendSignal(id, "offer", { type: "offer", sdp: offer.sdp });
    if (version === generation) set({ busy: false });
  } catch (error) {
    if (version !== generation) return;
    if (active(id)) { await failCall(id, error); return; }
    void request("end", { callId: id }).catch(() => {});
    reset("", friendly(error));
  }
}
export async function acceptCall() {
  const call = state.call;
  if (!call || call.calleeId !== userId || state.busy) return;
  const version = ++generation;
  set({ busy: true, error: "", status: "Opening your microphone…" });
  let accepted = false;
  try {
    const stream = await getMedia(call.mode);
    if (version !== generation) { stopStream(stream); return; }
    set({ local: stream });
    const result = await request("accept", { callId: call.id });
    if (version !== generation) { void request("end", { callId: call.id }).catch(() => {}); return; }
    accepted = true;
    set({ call: result.call, status: "Connecting…" });
    await prepare(result.call!, stream, version);
    if (version === generation) set({ busy: false });
  } catch (error) {
    if (version !== generation) return;
    if (accepted) failCall(call.id, error);
    else { releaseMedia(); set({ local: null, remote: null, busy: false, error: friendly(error), status: "Incoming call" }); }
  }
}
async function consume(signals: Signal[], id: string, version: number) {
  const peer = pc;
  if (!peer) return;
  for (const signal of signals) {
    if (version !== generation || !active(id)) return;
    if (signal.kind === "candidate") {
      if (peer.remoteDescription) await peer.addIceCandidate(signal.payload);
      else queuedCandidates.push(signal.payload);
    } else if (!peer.remoteDescription) {
      await peer.setRemoteDescription(signal.payload);
      for (const candidate of queuedCandidates) await peer.addIceCandidate(candidate);
      queuedCandidates = [];
      if (signal.kind === "offer") {
        const answer = await peer.createAnswer();
        if (version !== generation) return;
        await peer.setLocalDescription(answer);
        await sendSignal(id, "answer", { type: "answer", sdp: answer.sdp });
      }
    }
    if (version === generation) cursor = signal.sequence;
  }
}
async function poll() {
  if (!userId || polling || state.busy) return;
  const version = generation;
  polling = true;
  try {
    const result = await request("sync", { callId: state.call?.id, after: cursor });
    if (version !== generation) return;
    lastSuccess = Date.now();
    const call = result.call;
    if (!call) return;
    if (["declined", "ended", "missed"].includes(call.state)) {
      if (active(call.id)) reset(endedStatus(call));
      return;
    }
    if (!result.owned && (call.state === "accepted" || call.callerId === userId)) {
      if (active(call.id)) reset("Call continued on another device");
      return;
    }
    if (!state.call) set({ call, error: "", status: "Incoming call" });
    else set({ call, status: call.state === "accepted" && !state.connected ? "Connecting…" : state.status });
    await consume(result.signals, call.id, version);
  } catch (error) {
    if (version !== generation) return;
    if (state.call && Date.now() - lastSuccess > 20_000) failCall(state.call.id, new Error("The call connection was lost. Check your internet connection and try again."));
    else if (state.call && error instanceof DOMException) failCall(state.call.id, error);
  } finally { polling = false; }
}
export function startCallSync(id: string) {
  reset(); userId = id; lastSuccess = Date.now();
  void poll();
  const timer = setInterval(() => { if (state.call || document.visibilityState === "visible") void poll(); }, 1500);
  const focus = () => void poll();
  const leave = () => endCall();
  window.addEventListener("focus", focus); window.addEventListener("pagehide", leave);
  return () => {
    clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("pagehide", leave);
    endCall(); userId = null; reset();
  };
}
export function muteCall() {
  const muted = !state.muted; state.local?.getAudioTracks().forEach((track) => { track.enabled = !muted; }); set({ muted });
}
export function toggleCamera() {
  const cameraOff = !state.cameraOff; state.local?.getVideoTracks().forEach((track) => { track.enabled = !cameraOff; }); set({ cameraOff });
}
export function dismissCallMessage() { set({ error: "", status: "" }); }
