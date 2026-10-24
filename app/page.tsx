"use client";

import { useEffect, useRef, useState } from "react";
import { ORDERS } from "@/lib/orders";

type AgentState = "idle" | "listening" | "thinking" | "speaking";
type Msg = { role: "user" | "assistant"; content: string };

const GREETING = "Hi, this is Aria from Aura Skincare. How can I help you today?";

const DG_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&language=en-IN&smart_format=true" +
  "&interim_results=true&endpointing=500&utterance_end_ms=1000&vad_events=true";

const HEADLINE: Record<AgentState, string> = {
  idle: "Call ended",
  listening: "I’m listening",
  thinking: "One moment",
  speaking: "Aria is speaking",
};

const SUBLINE: Record<AgentState, string> = {
  idle: "Start a new conversation whenever you’re ready.",
  listening: "Go ahead and speak.",
  thinking: "Looking into that for you.",
  speaking: "Talk over her at any time to interrupt.",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600&display=swap');

.aria-root{
  --paper:#F2F5F0; --ink:#16261D; --soft:#5B6B61; --leaf:#2F6B4F; --mist:#DCE6DD;
  --panel:#FBFCFA; --gold:#E0A21B; --sky:#2D6A8F; --rust:#B3402F;
  font-family:'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif;
  background:var(--paper); color:var(--ink); min-height:100vh;
}
.aria-root *{box-sizing:border-box}
.display{font-family:'Bricolage Grotesque','Figtree',system-ui,sans-serif; letter-spacing:-0.025em}
.muted{color:var(--soft)}
.panel{background:var(--panel); border:1px solid var(--mist); border-radius:22px}

.btn{display:inline-flex; align-items:center; gap:.6rem; border-radius:999px; font-weight:600;
  padding:.9rem 1.6rem; cursor:pointer; border:0; transition:transform .15s ease, background .15s ease}
.btn:active{transform:scale(.98)}
.btn:focus-visible{outline:3px solid var(--gold); outline-offset:3px}
.btn-primary{background:var(--leaf); color:#fff}
.btn-primary:hover{background:#255a42}
.btn-end{background:var(--rust); color:#fff}
.btn-end:hover{background:#963527}

.bubble{max-width:86%; padding:.65rem .95rem; font-size:.95rem; line-height:1.45}
.bubble-aria{background:#fff; border:1px solid var(--mist); border-radius:18px 18px 18px 6px}
.bubble-user{background:var(--leaf); color:#fff; border-radius:18px 18px 6px 18px}
.bubble-live{border:1.5px dashed #9BB5A5; color:var(--soft); font-style:italic;
  border-radius:18px 18px 6px 18px; background:transparent}
.who{display:block; font-size:.72rem; opacity:.7; margin-bottom:.1rem}

.chip{border:1px solid var(--mist); background:#fff; border-radius:999px; padding:.35rem .8rem;
  font-size:.8rem; color:var(--soft)}
.log{scrollbar-width:thin; scrollbar-color:#C5D4C8 transparent}

.dot{display:inline-block; width:8px; height:8px; border-radius:999px}
.dot-out{background:var(--sky)} .dot-done{background:var(--leaf)} .dot-proc{background:var(--gold)}

/* The drop */
.drop{position:relative; --c1:#E3E9E2; --c2:#9BAAA0}
.drop[data-state=ready],.drop[data-state=listening]{--c1:#CFEBD8; --c2:#2F6B4F}
.drop[data-state=thinking]{--c1:#FBE6AE; --c2:#D48F06}
.drop[data-state=speaking]{--c1:#CBE0F1; --c2:#2D6A8F}
.drop-svg{position:absolute; inset:0; width:100%; height:100%; overflow:visible; transform-origin:50% 92%;
  filter:drop-shadow(0 18px 22px color-mix(in srgb, var(--c2) 35%, transparent))}
.drop-ring{position:absolute; left:50%; top:64%; width:72%; aspect-ratio:1/1; border-radius:50%;
  border:2px solid var(--c2); opacity:0; transform:translate(-50%,-50%) scale(.7); pointer-events:none}
.drop[data-state=listening] .drop-ring{animation:ripple 2.6s ease-out infinite}
.drop[data-state=listening] .drop-ring.r2{animation-delay:1.3s}
.drop[data-state=thinking] .drop-svg{animation:sway 2.4s ease-in-out infinite}
.drop[data-state=speaking] .drop-svg{animation:breathe 1.1s ease-in-out infinite}
.drop.float{animation:float 5s ease-in-out infinite}
.eye{transform-box:fill-box; transform-origin:center; animation:blink 5.5s infinite}
.mouth{transform-box:fill-box; transform-origin:50% 0%}
.drop[data-state=speaking] .mouth{animation:talk .42s ease-in-out infinite alternate}

@keyframes ripple{0%{opacity:.45; transform:translate(-50%,-50%) scale(.7)}100%{opacity:0; transform:translate(-50%,-50%) scale(1.9)}}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes talk{from{transform:scaleY(.8)}to{transform:scaleY(1.9)}}

@media (prefers-reduced-motion: reduce){
  .aria-root *{animation:none !important; transition:none !important}
}
`;

function Drop({ state, size }: { state: string; size: number }) {
  return (
    <div
      className={`drop ${state === "ready" ? "float" : ""}`}
      data-state={state}
      style={{ width: size, height: size * 1.2 }}
    >
      <span className="drop-ring" />
      <span className="drop-ring r2" />
      <svg viewBox="0 0 100 120" className="drop-svg" aria-hidden="true">
        <defs>
          <radialGradient id="dropGrad" cx="36%" cy="60%" r="75%">
            <stop offset="0%" style={{ stopColor: "var(--c1)" }} />
            <stop offset="100%" style={{ stopColor: "var(--c2)" }} />
          </radialGradient>
        </defs>
        <path
          d="M50 6 C50 6 14 46 14 76 A36 36 0 0 0 86 76 C86 46 50 6 50 6 Z"
          fill="url(#dropGrad)"
        />
        <ellipse
          cx="33"
          cy="72"
          rx="6"
          ry="12"
          fill="#fff"
          opacity="0.5"
          transform="rotate(16 33 72)"
        />
        <ellipse className="eye" cx="40" cy="76" rx="2.6" ry="3.2" fill="#16261D" />
        <ellipse className="eye" cx="60" cy="76" rx="2.6" ry="3.2" fill="#16261D" />
        <path
          className="mouth"
          d="M41 85 Q50 94 59 85"
          fill="none"
          stroke="#16261D"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-5 0V15l-3 1.5L3 14z" />
    </svg>
  );
}

function statusDot(status: string) {
  if (status === "Out for Delivery") return "dot-out";
  if (status === "Delivered") return "dot-done";
  return "dot-proc";
}

export default function Home() {
  const [state, setState] = useState<AgentState>("idle");
  const [transcript, setTranscript] = useState<Msg[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [inCall, setInCall] = useState(false);
  const [started, setStarted] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [summarizing, setSummarizing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const bufferRef = useRef("");
  const stateRef = useRef<AgentState>("idle");
  const activeRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [transcript, interim, summary, summarizing]);

  const changeState = (s: AgentState) => {
    stateRef.current = s;
    setState(s);
  };

  const addMessage = (m: Msg) => {
    messagesRef.current.push(m);
    setTranscript((t) => [...t, m]);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const speak = async (text: string, signal: AbortSignal) => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) throw new Error("Voice generation failed");
    const blob = await res.blob();
    if (!activeRef.current || signal.aborted) return;

    const audio = new Audio(URL.createObjectURL(blob));
    audioRef.current = audio;
    changeState("speaking");
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onpause = () => resolve();
      audio.play().catch(() => resolve());
    });
  };

  const respond = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    changeState("thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesRef.current }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (ctrl.signal.aborted) return;
      const text = data.text || "Sorry, could you please repeat that?";
      addMessage({ role: "assistant", content: text });
      await speak(text, ctrl.signal);
      if (stateRef.current === "speaking") changeState("listening");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Something went wrong. Please try again.");
      if (activeRef.current) changeState("listening");
    }
  };

  const greet = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    addMessage({ role: "assistant", content: GREETING });
    changeState("thinking");
    try {
      await speak(GREETING, ctrl.signal);
      if (stateRef.current === "speaking") changeState("listening");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Voice failed");
      if (activeRef.current) changeState("listening");
    }
  };

  const flush = () => {
    const text = bufferRef.current.trim();
    bufferRef.current = "";
    if (!text) return;
    addMessage({ role: "user", content: text });
    respond();
  };

  const startCall = async () => {
    setStarted(true);
        setSummary(null);
    setError("");
    setTranscript([]);
    setInterim("");
    messagesRef.current = [];
    bufferRef.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const tokRes = await fetch("/api/stt-token");
      const { token } = await tokRes.json();
      if (!token) throw new Error("Could not get a speech token");

      activeRef.current = true;
      setInCall(true);

      const ws = new WebSocket(DG_URL, ["bearer", token]);
      wsRef.current = ws;

      ws.onopen = () => {
        const recorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        recorder.start(250);
        recorderRef.current = recorder;
        greet();
      };

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "Results") {
          const text = (data.channel?.alternatives?.[0]?.transcript || "").trim();
          // Barge-in: the customer starts talking while Aria is speaking
          if (text && stateRef.current === "speaking") {
            stopAudio();
            changeState("listening");
          }
          if (data.is_final && text) {
            bufferRef.current += (bufferRef.current ? " " : "") + text;
          }
          setInterim(data.is_final ? "" : text);
          if (data.speech_final) flush();
        } else if (data.type === "UtteranceEnd") {
          flush();
        }
      };

      ws.onerror = () => setError("The speech connection failed. Please start a new conversation.");
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow the microphone in your browser, then try again."
          : e?.message || "Could not start the call."
      );
      endCall();
    }
  };

    const makeSummary = async (convo: Msg[]) => {
    setSummarizing(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: convo }),
      });
      setSummary(await res.json());
    } catch {
      setSummary({ error: "Could not generate the summary." });
    }
    setSummarizing(false);
  };

  const endCall = () => {
    const convo = [...messagesRef.current];
    activeRef.current = false;
    abortRef.current?.abort();
    stopAudio();
    try {
      recorderRef.current?.stop();
    } catch {}
    try {
      wsRef.current?.send(JSON.stringify({ type: "CloseStream" }));
      wsRef.current?.close();
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setInCall(false);
    setInterim("");
    changeState("idle");
    if (convo.some((m) => m.role === "user")) makeSummary(convo);
  };
  /* ---------- Welcome screen ---------- */
  if (!started) {
    return (
      <div className="aria-root">
        <style>{CSS}</style>
        <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:px-10">
          <div>
            <div className="display flex items-center gap-2 text-xl font-bold">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: "var(--leaf)" }} />
              Aura Skincare
            </div>
            <h1 className="display mt-10 text-4xl font-bold leading-[1.05] md:text-6xl">
              Skincare questions, answered out loud.
            </h1>
            <p className="muted mt-5 max-w-md text-lg leading-relaxed">
              Meet Aria. She can track your order, tell you what can still be cancelled, and explain
              our shipping and return rules. Just talk to her.
            </p>

            <button onClick={startCall} className="btn btn-primary mt-8 text-lg">
              <MicIcon />
              Start conversation
            </button>
            <p className="muted mt-4 max-w-sm text-sm">
              Your browser will ask for microphone access. Headphones work best.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="chip">Where is my order?</span>
              <span className="chip">Can I cancel it?</span>
              <span className="chip">What is your return policy?</span>
            </div>
          </div>

          <div className="relative flex items-center justify-center py-8">
            <div
              className="absolute rounded-full"
              style={{ width: "min(78vw, 420px)", height: "min(78vw, 420px)", background: "#E3ECE2" }}
            />
            <div className="relative">
              <Drop state="ready" size={230} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ---------- Call screen ---------- */
  return (
    <div className="aria-root">
      <style>{CSS}</style>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="flex items-center justify-between">
          <div className="display flex items-center gap-2 text-lg font-bold">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: "var(--leaf)" }} />
            Aura Skincare
          </div>
          <span className="muted text-sm">Voice support with Aria</span>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            <section className="panel flex flex-col items-center px-6 pb-7 pt-8 text-center">
              <div className="mb-2 mt-2">
                <Drop state={state} size={170} />
              </div>
              <h2 className="display mt-3 text-2xl font-bold" aria-live="polite">
                {HEADLINE[state]}
              </h2>
              <p className="muted mt-1 text-sm">{SUBLINE[state]}</p>

              <div className="mt-6">
                {inCall ? (
                  <button onClick={endCall} className="btn btn-end">
                    <PhoneIcon />
                    End call
                  </button>
                ) : (
                  <button onClick={startCall} className="btn btn-primary">
                    <MicIcon />
                    Start new conversation
                  </button>
                )}
              </div>
              {error && (
                <p className="mt-4 text-sm" style={{ color: "var(--rust)" }} role="alert">
                  {error}
                </p>
              )}
            </section>

            <section className="panel p-5">
              <h2 className="display text-lg font-bold">Test orders</h2>
              <p className="muted mt-1 text-sm">Say one of these order numbers to try a lookup.</p>
              <ul className="mt-4 divide-y" style={{ borderColor: "var(--mist)" }}>
                {Object.entries(ORDERS).map(([id, o]) => (
                  <li key={id} className="py-3 first:pt-0 last:pb-0" style={{ borderColor: "var(--mist)" }}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">{id}</span>
                      <span className="muted text-sm">₹{o.value}</span>
                    </div>
                    <div className="text-sm">
                      {o.product} for {o.customer}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className={`dot ${statusDot(o.status)}`} />
                      <span className="font-medium">{o.status}</span>
                    </div>
                    {o.note && <div className="muted mt-0.5 text-xs">{o.note}</div>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Right column */}
          <section className="panel flex min-h-[460px] flex-col p-5 lg:h-[calc(100vh-7rem)]">
            <h2 className="display text-lg font-bold">Conversation</h2>

            <div
              ref={listRef}
              role="log"
              className="log mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl p-3"
              style={{ background: "var(--paper)" }}
            >
              {transcript.length === 0 && !interim && (
                <p className="muted text-sm">
                  Connecting to Aria. Your conversation will appear here.
                </p>
              )}
              {transcript.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-aria"}`}>
                    <span className="who">{m.role === "user" ? "You" : "Aria"}</span>
                    {m.content}
                  </div>
                </div>
              ))}
              {interim && (
                <div className="flex justify-end">
                  <div className="bubble bubble-live">{interim}</div>
                </div>
              )}

                            {(summarizing || summary) && (
                <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--mist)" }}>
                  <h3 className="display text-base font-bold">Call summary</h3>
                  {summarizing && <p className="muted mt-2 text-sm">Writing the summary...</p>}
                  {summary && !summary.error && (
                    <>
                      <p className="mt-2 text-sm">{summary.call_summary}</p>
                      <pre
                        className="mt-3 overflow-x-auto rounded-xl p-3 text-xs"
                        style={{ background: "var(--paper)" }}
                      >
                        {JSON.stringify(summary, null, 2)}
                      </pre>
                    </>
                  )}
                  {summary?.error && (
                    <p className="mt-2 text-sm" style={{ color: "var(--rust)" }}>
                      {summary.error}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="muted mb-2 text-xs">Try saying</p>
              <div className="flex flex-wrap gap-2">
                <span className="chip">Where is my order ORD-101?</span>
                <span className="chip">Can I return ORD-102?</span>
                <span className="chip">Please cancel ORD-103</span>
                <span className="chip">Book me a flight to Goa</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}