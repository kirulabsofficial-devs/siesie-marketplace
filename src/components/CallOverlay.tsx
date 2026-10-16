import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { acceptCall, dismissCallMessage, endCall, muteCall, startCallSync, toggleCamera, useCallState } from "../data/calls";
import { LIVE_BACKEND } from "../data/runtime";
import { useDb } from "../data/store";
import { Avatar, Button, Dialog } from "./ui";
import "../styles/calls.css";

function CallMedia({ stream, local = false, video }: { stream: MediaStream | null; local?: boolean; video: boolean }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !stream) return;
    element.srcObject = stream;
    void element.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    return () => { element.srcObject = null; };
  }, [stream]);
  const resume = () => void ref.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  return <>
    {video ? <video ref={ref} autoPlay playsInline muted={local} className={local ? "call-local-video" : "call-remote-video"} aria-label={local ? "Your camera" : "Other person's camera"} /> : <audio ref={ref} autoPlay aria-label="Call audio" />}
    {blocked && !local && <button className="call-resume" onClick={resume}>Tap to hear the call</button>}
  </>;
}
export function CallOverlay() {
  const session = useDb((db) => db.session);
  const state = useCallState();
  const { call, busy } = state;
  useEffect(() => {
    if (LIVE_BACKEND && session && session.role !== "admin") return startCallSync(session.userId);
  }, [session?.userId, session?.role]);
  if (!LIVE_BACKEND) return null;
  const incoming = call?.state === "ringing" && call.calleeId === session?.userId;
  const video = call?.mode === "video";
  return <>
    <Dialog open={!!call || busy} onClose={endCall} title={call ? `${video ? "Video" : "Voice"} call` : "Starting your call"} wide={video}>
      <div className="call-stage">
        {video && state.remote && <CallMedia stream={state.remote} video />}
        <div className="call-person"><Avatar name={call?.peerName || "Siesie"} size="xl" /><h3>{call?.peerName || "One moment…"}</h3><p role="status">{incoming && !busy ? "Incoming call" : state.status}</p></div>
        {state.local && video && <div className={state.cameraOff ? "call-preview camera-off" : "call-preview"}><CallMedia stream={state.local} local video /><span>{state.cameraOff ? "Camera off" : "You"}</span></div>}
        {!video && state.remote && <CallMedia stream={state.remote} video={false} />}
      </div>
      {state.error && <p className="chat-error" role="alert">{state.error}</p>}
      <div className="call-controls">
        {incoming ? <>
          <Button variant="danger" onClick={endCall}><PhoneOff size={18} />Decline</Button>
          <Button disabled={busy} onClick={() => void acceptCall()}><Phone size={18} />{busy ? "Connecting…" : "Accept"}</Button>
        </> : <>
          {state.local && <button onClick={muteCall} className="call-control" aria-label={state.muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={state.muted}>{state.muted ? <MicOff /> : <Mic />}<span>{state.muted ? "Unmute" : "Mute"}</span></button>}
          {state.local && video && <button onClick={toggleCamera} className="call-control" aria-label={state.cameraOff ? "Turn camera on" : "Turn camera off"} aria-pressed={state.cameraOff}>{state.cameraOff ? <VideoOff /> : <Video />}<span>Camera</span></button>}
          <button className="call-control call-hangup" onClick={endCall} aria-label="End call"><PhoneOff /><span>End call</span></button>
        </>}
      </div>
      <p className="call-footnote">{incoming ? `Accept to share your microphone${video ? " and camera" : ""}.` : "Calls aren’t recorded. Keep this page open during your call."}</p>
    </Dialog>
    {!call && !busy && (state.status || state.error) && <div className="call-notice" role={state.error ? "alert" : "status"}><span>{state.error || state.status}</span><button onClick={dismissCallMessage}>Dismiss</button></div>}
  </>;
}
