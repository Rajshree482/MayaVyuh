import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSyncState, broadcastEvent, useEventListener } from "./useSync.js";
import {
  AdminDashboard, LandingPage, SceneWrapper, GlobalStyles, OraclesLockGame, BG_IMAGES,
} from "./AdminComponents.jsx";

import bg1 from "./assets/bg-1.jpg";
import bg2 from "./assets/bg-2.jpg";
import bg3 from "./assets/bg-3.jpg";
import bg4 from "./assets/bg-4.jpg";
import bg5 from "./assets/bg-5.jpg";

const INIT_TEAMS  = [];
const INIT_WORDS  = ["dragon", "ancient", "fire"];
const INIT_TIMERS = { round1: 300, round2: 300, round3: 300, discussion: 120, swap: 60 };
const INIT_EVENT  = { started: false };

// ─── STORAGE KEYS FOR STATE RECOVERY ─────────────────────────────────────────
const STORAGE_KEY_SESSION = "maya_player_session";

function saveSession(data) {
  try { localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(data)); } catch {}
}
function loadSession() {
  try { const d = localStorage.getItem(STORAGE_KEY_SESSION); return d ? JSON.parse(d) : null; } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY_SESSION); } catch {}
}

// ─── ANTI-CHEAT HOOK ──────────────────────────────────────────────────────────
// FIX: blur fires only during active rounds (not lobby/waiting/intervals)
// FIX: window blur has a 1.5s grace period to ignore accidental OS notifications
const useAntiCheat = (enabled, phase, onViolation) => {
  const vc        = useRef(0);
  const blurTimer = useRef(null);

  // phases where anti-cheat should NOT fire for blur/focus
  const SAFE_PHASES = ["lobby", "waiting", "interval1", "interval2", "r3select", "submission", "judgment"];

  useEffect(() => {
    if (!enabled) return;

    const onVis = () => {
      if (document.hidden) {
        // Tab switch is always tracked regardless of phase
        vc.current++;
        onViolation("TAB_SWITCH", `Tab switched — violation #${vc.current}`, vc.current);
      }
    };

    const onBlur = () => {
      // Grace period: ignore blur in safe phases or if it resolves within 1.5s
      if (SAFE_PHASES.includes(phase)) return;
      blurTimer.current = setTimeout(() => {
        onViolation("WINDOW_BLUR", "Window blurred for >1.5s during active round", vc.current);
      }, 1500);
    };

    const onFocus = () => {
      // Cancel the blur timer if the window comes back within 1.5s
      if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = null; }
    };

    const onBef = (e) => {
      onViolation("PAGE_LEAVE", "Attempted to leave the page", vc.current);
      e.preventDefault();
      e.returnValue = "The Oracle is watching. Leaving will disqualify your team.";
      return e.returnValue;
    };

    const onCtx  = (e) => e.preventDefault();

    const onKey = (e) => {
      if (e.ctrlKey && (e.key==="t"||e.key==="n"||e.key==="w")) {
        e.preventDefault();
        onViolation("HOTKEY", "Ctrl+" + e.key + " blocked", vc.current);
      }
      if (e.key==="F12" || (e.ctrlKey&&e.shiftKey&&(e.key==="I"||e.key==="J"))) {
        e.preventDefault();
        onViolation("DEVTOOLS", "DevTools shortcut blocked", vc.current);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeunload", onBef);
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeunload", onBef);
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("keydown", onKey);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, [enabled, phase, onViolation]);
};

// ─── PLAYER SWAP GATE (PIN-based soft enforcement) ────────────────────────────
// Both players agree on a 4-digit PIN at the start.
// Before Round 2 starts, Player 2 must re-enter the PIN to confirm the swap.
const SwapGate = ({ playerName, onConfirm, title, subtitle }) => {
  const [pin, setPin]       = useState("");
  const [stored, setStored] = useState(() => localStorage.getItem("maya_swap_pin")||"");
  const [setting, setSetting] = useState(!localStorage.getItem("maya_swap_pin"));
  const [error, setError]   = useState("");

  const handleKey = (digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      if (setting) {
        localStorage.setItem("maya_swap_pin", next);
        setStored(next);
        setSetting(false);
        setPin("");
      } else {
        if (next === stored) {
          onConfirm();
        } else {
          setError("Wrong PIN — try again");
          setTimeout(() => { setPin(""); setError(""); }, 900);
        }
      }
    }
  };

  return (
    <div className="swap-gate">
      {/* Background image gives depth */}
      <div style={{
        position:"absolute", inset:0, backgroundImage:`url(${bg2})`,
        backgroundSize:"cover", backgroundPosition:"center",
        opacity:0.12, filter:"sepia(0.5) brightness(0.6)", zIndex:0
      }}/>
      <div style={{position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", maxWidth:380, width:"100%"}}>
        <div style={{fontSize:52, marginBottom:16}}>🔒</div>
        <div className="swap-gate-title">{title || "Player Swap Required"}</div>
        <div style={{fontFamily:"'IM Fell English',serif", color:"var(--parchment-dim)", fontStyle:"italic", fontSize:16, marginBottom:28, textAlign:"center", lineHeight:1.7}}>
          {subtitle || `"${playerName}, enter the Oracle's PIN to confirm the swap"`}
        </div>

        {setting && (
          <div style={{fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:"var(--oracle-blue)", letterSpacing:2, marginBottom:16, textAlign:"center"}}>
            SET A 4-DIGIT PIN THAT BOTH PLAYERS KNOW
          </div>
        )}

        {/* PIN dots */}
        <div className="pin-dots">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${pin.length > i ? "filled" : ""}`}/>
          ))}
        </div>
        {error && <div style={{color:"var(--blood-glow)", fontFamily:"'Share Tech Mono',monospace", fontSize:12, letterSpacing:2, marginBottom:8}}>{error}</div>}

        {/* PIN keypad */}
        <div className="pin-keys">
          {[1,2,3,4,5,6,7,8,9,"⌫","0","✓"].map((k,i) => (
            <div key={i} className="pin-key"
              onClick={() => {
                if (k === "⌫") { setPin(p => p.slice(0,-1)); setError(""); }
                else if (k === "✓") { /* handled via pin length */ }
                else handleKey(String(k));
              }}>
              {k}
            </div>
          ))}
        </div>
        {setting && (
          <div style={{fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--parchment-dim)", marginTop:16, textAlign:"center", letterSpacing:1}}>
            Both players must remember this PIN for all swaps
          </div>
        )}
      </div>
    </div>
  );
};

// ─── LOBBY ────────────────────────────────────────────────────────────────────
const Lobby = ({ onSubmit }) => {
  const [step, setStep]         = useState(1);
  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1]   = useState("");
  const [player2, setPlayer2]   = useState("");
  const [role, setRole]         = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleIdentity = () => { if (teamName && player1 && player2) setStep(2); };
  const handleSubmit   = () => { if (!role) return; setSubmitted(true); onSubmit({ teamName, player1, player2, role }); };

  if (submitted) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:2, position:"relative", padding:24 }}>
      {/* Section bg: temple image */}
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg2})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.1, filter:"sepia(0.5) brightness(0.6)", zIndex:0 }}/>
      <div style={{ textAlign:"center", maxWidth:500, animation:"fadeInUp 0.8s ease-out", position:"relative", zIndex:1 }}>
        <div style={{ fontSize:72, marginBottom:24, animation:"oraclePulse 2s infinite", display:"inline-block" }}>⏳</div>
        <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:22, color:"var(--rune-gold)", animation:"goldPulse 2s infinite", marginBottom:12 }}>
          Awaiting Admin Approval...
        </div>
        <div style={{ fontFamily:"'IM Fell English',serif", color:"var(--parchment-dim)", fontStyle:"italic", fontSize:16, lineHeight:1.8 }}>
          "Your name has been inscribed in the Oracle's scroll. The Admin must grant passage before you enter the labyrinth."
        </div>
        <div style={{ marginTop:40, opacity:0.4 }}>
          <svg viewBox="0 0 100 100" width={100} height={100} fill="none" stroke="var(--rune-gold)" strokeWidth="1.5"
            style={{ animation:"runeFloat 4s ease-in-out infinite" }}>
            <circle cx="50" cy="50" r="47" opacity="0.3"/>
            <rect x="20" y="20" width="60" height="60" rx="4" opacity="0.4"
              style={{ strokeDasharray:240, strokeDashoffset:240, animation:"labyLoading 2s ease-out forwards" }}/>
            <path d="M50 20L50 80M20 50L80 50" opacity="0.4"/>
            <circle cx="50" cy="50" r="5" fill="var(--rune-gold)" opacity="0.8"/>
          </svg>
        </div>
      </div>
    </div>
  );

  return (
    <div className="lobby-wrap" style={{ position:"relative" }}>
      {/* Scroll / parchment bg for lobby */}
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg1})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.08, filter:"sepia(0.7) brightness(0.7)", zIndex:0 }}/>
      <div style={{ textAlign:"center", maxWidth:820, width:"100%", animation:"fadeInUp 0.8s ease-out", position:"relative", zIndex:1 }}>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, color:"var(--oracle-blue)", letterSpacing:4, marginBottom:12 }}>⬡ ENTER THE LABYRINTH ⬡</div>
        <div className="lobby-title">MayaVyuh</div>
        <div style={{ fontFamily:"'IM Fell English',serif", fontSize:19, color:"var(--parchment-dim)", fontStyle:"italic", marginBottom:40, letterSpacing:2 }}>The Prompt War</div>

        {step === 1 ? (
          <>
            <div className="card" style={{ maxWidth:520, margin:"0 auto 24px", textAlign:"left" }}>
              <div className="card-title">⬡ Your Identity</div>
              <div className="form-group">
                <label className="form-label">Team Name</label>
                <input className="form-input" value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Name your fellowship..."/>
              </div>
              <div className="form-group">
                <label className="form-label">Player 1 — Name</label>
                <input className="form-input" value={player1} onChange={e=>setPlayer1(e.target.value)} placeholder="First warrior's name..."/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Player 2 — Name</label>
                <input className="form-input" value={player2} onChange={e=>setPlayer2(e.target.value)} placeholder="Second warrior's name..."/>
              </div>
            </div>
            <button className="btn btn-gold" style={{ fontSize:16, padding:"14px 44px", letterSpacing:4 }}
              onClick={handleIdentity} disabled={!teamName||!player1||!player2}>
              CHOOSE ROLES →
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:14, color:"var(--rune-gold)", marginBottom:20 }}>
              TEAM: {teamName.toUpperCase()}
            </div>
            <div className="role-cards">
              <div className={`role-card observer ${role==="observer"?"selected":""}`} onClick={()=>setRole("observer")}>
                <span style={{ position:"absolute", top:12, right:12, background:"rgba(0,212,255,0.15)", color:"var(--oracle-blue)", border:"1px solid rgba(0,212,255,0.3)", padding:"3px 8px", borderRadius:2, fontFamily:"'Share Tech Mono',monospace", fontSize:11, letterSpacing:1 }}>ROUND 1 & 3</span>
                <span style={{ fontSize:44, marginBottom:14, display:"block" }}>👁️</span>
                <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:19, color:"var(--oracle-blue)", marginBottom:8 }}>The Observer</div>
                <p style={{ fontFamily:"'IM Fell English',serif", fontSize:14, color:"var(--parchment-dim)", fontStyle:"italic", lineHeight:1.6 }}>
                  "Study the sacred image and transmit its essence through words alone."
                </p>
                <div style={{ marginTop:10, fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--parchment-dim)" }}>
                  {player1} plays first
                </div>
              </div>
              <div className={`role-card creator ${role==="creator"?"selected":""}`} onClick={()=>setRole("creator")}>
                <span style={{ position:"absolute", top:12, right:12, background:"rgba(139,92,246,0.15)", color:"var(--spirit-purple)", border:"1px solid rgba(139,92,246,0.3)", padding:"3px 8px", borderRadius:2, fontFamily:"'Share Tech Mono',monospace", fontSize:11, letterSpacing:1 }}>ROUND 2</span>
                <span style={{ fontSize:44, marginBottom:14, display:"block" }}>✨</span>
                <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:19, color:"var(--spirit-purple)", marginBottom:8 }}>The Creator</div>
                <p style={{ fontFamily:"'IM Fell English',serif", fontSize:14, color:"var(--parchment-dim)", fontStyle:"italic", lineHeight:1.6 }}>
                  "Receive the Observer's transmission and manifest the vision through AI."
                </p>
                <div style={{ marginTop:10, fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--parchment-dim)" }}>
                  {player2} plays first
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap" }}>
              <button className="btn btn-ghost" onClick={()=>setStep(1)}>← BACK</button>
              <button className="btn btn-gold" style={{ fontSize:16, padding:"14px 44px", letterSpacing:4 }}
                onClick={handleSubmit} disabled={!role}>
                ⚡ ENTER THE LABYRINTH
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── WAITING LOBBY ────────────────────────────────────────────────────────────
const WaitingLobby = ({ teamName, otherTeams, observerName, observerTimerMax, observerTimeLeft, observerText, winners }) => {
  const pct  = observerTimerMax > 0 ? (observerTimeLeft / observerTimerMax) * 100 : 100;
  const mins = Math.floor(Math.max(0, observerTimeLeft) / 60);
  const secs = Math.max(0, observerTimeLeft) % 60;

  if (winners && winners.length > 0) return <VictoryScreen winners={winners} teamName={teamName}/>;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", minHeight:"calc(100vh - 44px)", overflow:"hidden", position:"relative" }}>
      {/* Temple bg on waiting lobby */}
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg2})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.07, filter:"sepia(0.4) brightness(0.6)", zIndex:0, pointerEvents:"none" }}/>

      {/* Main */}
      <div style={{ padding:"28px 24px", display:"flex", flexDirection:"column", gap:18, overflowY:"auto", borderRight:"1px solid var(--border-rune)", position:"relative", zIndex:1 }}>
        <div>
          <div className="phase-label">⬡ WAITING CHAMBER · CREATOR'S SANCTUM</div>
          <div className="phase-title">{teamName} — Awaiting Transmission</div>
          <div style={{ fontFamily:"'IM Fell English',serif", fontSize:15, color:"var(--parchment-dim)", fontStyle:"italic", lineHeight:1.7 }}>
            "{observerName} is studying the sacred vision. Their words will arrive soon. Prepare your mind."
          </div>
        </div>

        {/* Observer progress */}
        <div className="card">
          <div className="card-title">📡 Observer Progress — {observerName}</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:8 }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:"var(--oracle-blue)" }}>
              <span className="live-dot"/>TRANSMITTING...
            </div>
            <div className={`timer-display ${pct<20?"danger":""}`} style={{ fontSize:"clamp(20px,4vw,30px)" }}>
              {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
            </div>
          </div>
          <div className="timer-bar"><div className={`timer-fill ${pct<20?"danger":""}`} style={{ width:`${pct}%` }}/></div>
          {observerText && (
            <div style={{ marginTop:12, fontFamily:"'IM Fell English',serif", fontSize:14, color:"var(--parchment-dim)", fontStyle:"italic", lineHeight:1.7, padding:12, background:"rgba(0,212,255,0.04)", border:"1px solid var(--border-oracle)", borderRadius:4 }}>
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:"var(--oracle-blue)", letterSpacing:2, display:"block", marginBottom:5 }}>LIVE TRANSMISSION</span>
              {observerText}
            </div>
          )}
        </div>

        {/* Oracle's Lock */}
        <div className="card" style={{ flex:1 }}>
          <div className="card-title">🔮 Oracle's Lock — Mental Preparation</div>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--parchment-dim)", letterSpacing:2, marginBottom:10 }}>
            Align all rune rings to the apex ↑ while you wait
          </div>
          <OraclesLockGame/>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ padding:"22px 16px", display:"flex", flexDirection:"column", gap:16, overflowY:"auto", background:"rgba(4,5,10,0.75)", position:"relative", zIndex:1 }}>
        <div>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--rune-gold)", letterSpacing:3, marginBottom:12 }}>⬡ OTHER TEAMS</div>
          {(otherTeams||[]).map((t,i)=>(
            <div key={i} style={{ background:"rgba(8,12,20,0.85)", border:`1px solid ${t.name===teamName?"var(--rune-gold)":"var(--border-rune)"}`, borderRadius:4, padding:"10px 12px", marginBottom:8, transition:"all 0.3s" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:t.name===teamName?"var(--rune-gold)":"var(--text-bright)", marginBottom:4 }}>
                {t.name} {t.name===teamName&&"(You)"}
              </div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--parchment-dim)", marginBottom:5 }}>R{t.round||0}</div>
              <div className="timer-bar" style={{ margin:0 }}><div className="timer-fill" style={{ width:`${t.timeLeft&&t.totalTime ? Math.max(0,(t.timeLeft/t.totalTime)*100) : 50}%` }}/></div>
            </div>
          ))}
          {(!otherTeams||otherTeams.length===0)&&<p style={{ fontFamily:"'IM Fell English',serif", color:"var(--parchment-dim)", fontStyle:"italic", fontSize:13 }}>No other teams yet.</p>}
        </div>

        {/* Phase steps */}
        <div style={{ background:"rgba(8,12,20,0.85)", border:"1px solid var(--border-rune)", borderRadius:4, padding:14 }}>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:"var(--rune-gold)", letterSpacing:2, marginBottom:10 }}>⬡ GAME PHASES</div>
          {[
            {label:"Register",  done:true, active:false},
            {label:"Obs R1",    done:false,active:true},
            {label:"Discussion",done:false,active:false},
            {label:"Creator R2",done:false,active:false},
            {label:"Swap",      done:false,active:false},
            {label:"Obs R3",    done:false,active:false},
            {label:"Submit",    done:false,active:false},
            {label:"Judgment",  done:false,active:false},
          ].map((ph,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"4px 0", borderBottom:"1px solid rgba(200,146,10,0.05)" }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background:ph.done?"rgba(0,255,136,0.15)":ph.active?"rgba(200,146,10,0.15)":"rgba(200,146,10,0.05)", border:`1px solid ${ph.done?"#00ff88":ph.active?"var(--rune-gold)":"rgba(200,146,10,0.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, flexShrink:0 }}>
                {ph.done?"✓":ph.active?"→":i+1}
              </div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:ph.done?"#00ff88":ph.active?"var(--rune-gold)":"var(--parchment-dim)" }}>{ph.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background:"rgba(8,12,20,0.85)", border:"1px solid var(--border-oracle)", borderRadius:4, padding:14 }}>
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:"var(--oracle-blue)", letterSpacing:2, marginBottom:7 }}>🔮 ORACLE BROADCAST</div>
          <div style={{ fontFamily:"'IM Fell English',serif", fontSize:13, color:"var(--parchment-dim)", fontStyle:"italic", lineHeight:1.6 }}>
            "The vision travels between minds. Be ready, Creator — when the transmission arrives, your trial begins."
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── GEMINI UI ────────────────────────────────────────────────────────────────
// FIX: forbidden word check now scans ALL words in the textarea, not just the last one
const GEN_PHRASES = ["Invoking the Oracle...","Weaving light and shadow...","Manifesting the vision...","Almost there...","Sealing the spell..."];

const GeminiUI = ({ forbiddenWords, onSelect, timerDuration, isRefining, imagesToRefine, roundLabel, onTextChange, currentPlayer, bgImage }) => {
  const [prompt, setPrompt]               = useState("");
  const [gallery, setGallery]             = useState([]);
  const [generating, setGenerating]       = useState(false);
  const [timeLeft, setTimeLeft]           = useState(timerDuration||300);
  const [selectedImage, setSelectedImage] = useState(null);
  const [forbidden, setForbidden]         = useState(false);
  const [showTooltip, setShowTooltip]     = useState(false);
  const [rejectedWord, setRejectedWord]   = useState("");
  const [genPhrase, setGenPhrase]         = useState(0);
  const autoSubmitFired                   = useRef(false);
  const tooltipTimer                      = useRef(null);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(tl => {
      if (tl <= 1) {
        clearInterval(t);
        if (!autoSubmitFired.current) {
          autoSubmitFired.current = true;
          if (selectedImage) onSelect(selectedImage);
          else if (gallery.length) onSelect(gallery[0]);
          else onSelect("https://picsum.photos/seed/fallback/400/400");
        }
        return 0;
      }
      return tl - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []); // intentionally empty — timer runs once, refs capture latest values

  // Keep latest values accessible to timer closure via refs
  const selectedRef = useRef(selectedImage);
  const galleryRef  = useRef(gallery);
  useEffect(() => { selectedRef.current = selectedImage; }, [selectedImage]);
  useEffect(() => { galleryRef.current = gallery; }, [gallery]);

  // ── FIX: scan ALL words in the textarea on every change ──────────────────
  const checkForbiddenWords = (text) => {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const fw    = (forbiddenWords || []).map(w => w.toLowerCase());
    for (const word of words) {
      if (fw.includes(word)) return word;
    }
    return null;
  };

  const handleChange = (e) => {
    const text  = e.target.value;
    const found = checkForbiddenWords(text);

    if (found) {
      // Remove ALL occurrences of the forbidden word from the text
      const cleaned = text.replace(new RegExp(`\\b${found}\\b`, "gi"), "").replace(/\s{2,}/g, " ");
      setRejectedWord(found.toUpperCase());
      setForbidden(true);
      setShowTooltip(true);
      setPrompt(cleaned);
      onTextChange?.(cleaned);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => { setForbidden(false); setShowTooltip(false); }, 2500);
    } else {
      setForbidden(false);
      setPrompt(text);
      onTextChange?.(text);
    }
  };

  const handleGenerate = () => {
    if (!prompt || generating) return;
    setGenerating(true);
    let pi = 0;
    const pt = setInterval(() => { pi=(pi+1)%GEN_PHRASES.length; setGenPhrase(pi); }, 600);
    setTimeout(() => {
      clearInterval(pt);
      const seed = Date.now();
      const imgs = [`https://picsum.photos/seed/${seed}/400/400`, `https://picsum.photos/seed/${seed+1}/400/400`, `https://picsum.photos/seed/${seed+2}/400/400`];
      setGallery(imgs);
      setSelectedImage(imgs[0]);
      setGenerating(false);
    }, 2500);
  };

  const pct  = (timeLeft / (timerDuration||300)) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="creator-wrap" style={{ animation:"fadeInUp 0.5s ease-out", position:"relative" }}>
      {/* Section-specific bg image */}
      <div style={{
        position:"absolute", inset:0,
        backgroundImage:`url(${bgImage || bg3})`,
        backgroundSize:"cover", backgroundPosition:"center",
        opacity:0.25, filter:"sepia(0.5) brightness(0.6)",
        zIndex:0, pointerEvents:"none"
      }}/>
      {showTooltip && (
        <div className="word-rejected-tooltip">
          🚫 FORBIDDEN: "{rejectedWord}" — REMOVED BY THE ORACLE
        </div>
      )}

      {/* Left pane */}
      <div className="transmission-pane" style={{ position:"relative", zIndex:1 }}>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--oracle-blue)", letterSpacing:3, marginBottom:10 }}>
          {isRefining ? "📡 REFINE TARGET" : "🎯 TARGET VISION"}
        </div>
        <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:13, color:"var(--rune-gold)", marginBottom:14, animation:"goldPulse 3s infinite" }}>
          {roundLabel||"GENERATION PHASE"}
        </div>
        {currentPlayer && (
          <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--spirit-purple)", letterSpacing:2, marginBottom:12, padding:"6px 10px", background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.3)", borderRadius:3 }}>
            ⚔️ ACTIVE: {currentPlayer}
          </div>
        )}

        {isRefining ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {(imagesToRefine||[]).map((img,i)=>(
              <div key={i} style={{ border:"1px solid var(--border-oracle)", padding:4, borderRadius:4, overflow:"hidden" }}>
                <img src={img} alt="refine" style={{ width:"100%", borderRadius:3, display:"block" }}/>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border:"1px solid var(--border-oracle)", padding:4, borderRadius:4, overflow:"hidden", position:"relative" }}>
            <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg2})`, backgroundSize:"cover", opacity:0.3, zIndex:0 }}/>
            <img src="https://picsum.photos/seed/mayatarget/400/400" alt="target" style={{ width:"100%", borderRadius:3, display:"block", position:"relative", zIndex:1 }}/>
          </div>
        )}

        {/* Forbidden words — HIDDEN from Observer during round 1 to remove unfair advantage */}
        {isRefining && (
          <div style={{ marginTop:16, padding:10, background:"rgba(204,34,0,0.06)", border:"1px solid rgba(204,34,0,0.25)", borderRadius:4 }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:"var(--blood-glow)", letterSpacing:2, marginBottom:6 }}>FORBIDDEN WORDS</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {(forbiddenWords||[]).map((w,i)=>(
                <span key={i} style={{ background:"rgba(204,34,0,0.1)", border:"1px solid rgba(204,34,0,0.25)", color:"var(--blood-glow)", padding:"2px 7px", borderRadius:2, fontFamily:"'Share Tech Mono',monospace", fontSize:11 }}>{w}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop:16 }}>
          <div className={`timer-display ${timeLeft<60?"danger":""}`}>{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</div>
          <div className="timer-bar"><div className={`timer-fill ${timeLeft<60?"danger":""}`} style={{ width:`${pct}%` }}/></div>
          {timeLeft<60&&<div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--blood-glow)", textAlign:"center", marginTop:5, letterSpacing:2 }}>AUTO-SUBMIT IN {timeLeft}s</div>}
        </div>
      </div>

      {/* Right pane */}
      <div style={{ display:"flex", flexDirection:"column", minHeight:0, position:"relative", zIndex:1 }}>
        <div style={{ padding:"24px 24px 0", display:"flex", flexDirection:"column", gap:14, flex:1, overflowY:"auto" }}>
          <div>
            <div className="phase-label">⬡ YOUR SPELL</div>
            <textarea
              className={`prompt-box ${forbidden?"forbidden":""}`}
              value={prompt}
              onChange={handleChange}
              placeholder="Craft your generation prompt... Avoid the forbidden words — the Oracle is watching every keystroke."
              style={{ minHeight:130 }}
            />
          </div>

          <button className="generate-btn" onClick={handleGenerate} disabled={generating||!prompt} style={{ position:"relative", overflow:"hidden" }}>
            {generating ? (
              <span style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"center" }}>
                <span style={{ animation:"runeFloat 1s ease-in-out infinite", display:"inline-block" }}>⚗️</span>
                {GEN_PHRASES[genPhrase]}
              </span>
            ) : "✨ GENERATE VISION"}
            {generating&&<div style={{ position:"absolute", bottom:0, left:0, height:3, background:"var(--oracle-blue)", boxShadow:"0 0 12px var(--oracle-blue)", animation:"growBar 2.5s linear forwards" }}/>}
          </button>

          {gallery.length > 0 && (
            <div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--oracle-blue)", letterSpacing:2, marginBottom:8 }}>⬡ SELECT YOUR BEST VISION</div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                {gallery.map((img,idx)=>(
                  <div key={idx} onClick={()=>setSelectedImage(img)}
                    style={{ flex:"1 1 100px", minWidth:90, border:selectedImage===img?"2px solid var(--rune-gold)":"2px solid transparent", cursor:"pointer", borderRadius:4, overflow:"hidden", boxShadow:selectedImage===img?"0 0 20px rgba(200,146,10,0.4)":"none", transition:"all 0.3s" }}>
                    <img src={img} alt="gen" style={{ width:"100%", display:"block" }}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="submit-btn" onClick={()=>{ if(selectedImage&&!autoSubmitFired.current){ autoSubmitFired.current=true; onSelect(selectedImage); }}} disabled={!selectedImage}
            style={{ position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", inset:0, background:"rgba(139,92,246,0.25)", transformOrigin:"left", width:`${100-pct}%`, transition:"width 1s linear" }}/>
            <span style={{ position:"relative", zIndex:1 }}>⚡ SUBMIT FINAL SPELL</span>
          </button>
        </div>
        <div style={{ height:8 }}/>
      </div>
      <style>{`@keyframes growBar{from{width:0}to{width:100%}}`}</style>
    </div>
  );
};

// ─── INTERVAL SCREENS ─────────────────────────────────────────────────────────
const DiscussionInterval = ({ onComplete, duration }) => {
  const [tl, setTl] = useState(duration||120);
  useEffect(()=>{const t=setInterval(()=>setTl(x=>{if(x<=1){clearInterval(t);onComplete();return 0;}return x-1;}),1000);return()=>clearInterval(t);},[]);
  const m=Math.floor(tl/60), s=tl%60;
  return (
    <div className="transfer-screen" style={{ position:"relative" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg1})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.1, filter:"sepia(0.6) brightness(0.5)", zIndex:0 }}/>
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ fontSize:60, marginBottom:20 }}>🎙️</div>
        <div className="transfer-text">Verbal Transfer Active</div>
        <div style={{ fontFamily:"'IM Fell English',serif", color:"var(--parchment-dim)", fontStyle:"italic", marginTop:10, fontSize:16, textAlign:"center", maxWidth:500, lineHeight:1.7 }}>
          "Explain the vision to your teammate verbally. The original image is now hidden. Use only words — no gestures, no drawings."
        </div>
        <div className="timer-display" style={{ marginTop:28 }}>{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</div>
        <div className="timer-bar" style={{ width:"min(300px,80vw)", margin:"8px auto" }}>
          <div className="timer-fill" style={{ width:`${(tl/(duration||120))*100}%` }}/>
        </div>
      </div>
    </div>
  );
};

const SwapInterval = ({ onComplete, duration, swapTo }) => {
  const [tl, setTl] = useState(duration||60);
  useEffect(()=>{const t=setInterval(()=>setTl(x=>{if(x<=1){clearInterval(t);onComplete();return 0;}return x-1;}),1000);return()=>clearInterval(t);},[]);
  const m=Math.floor(tl/60), s=tl%60;
  return (
    <div className="transfer-screen" style={{ position:"relative" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg5})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.1, filter:"sepia(0.5) brightness(0.5)", zIndex:0 }}/>
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ fontSize:60, marginBottom:20 }}>🔀</div>
        <div className="transfer-text">Player Swap</div>
        <div style={{ fontFamily:"'IM Fell English',serif", color:"var(--parchment-dim)", fontStyle:"italic", marginTop:10, fontSize:16, textAlign:"center", maxWidth:500, lineHeight:1.7 }}>
          {swapTo ? `"${swapTo} returns to the keyboard. No communication during this interval."` : "No communication allowed during this interval."}
        </div>
        <div className="timer-display" style={{ marginTop:28 }}>{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</div>
        <div className="timer-bar" style={{ width:"min(300px,80vw)", margin:"8px auto" }}>
          <div className="timer-fill" style={{ width:`${(tl/(duration||60))*100}%` }}/>
        </div>
      </div>
    </div>
  );
};

// ─── REFINEMENT SELECTION ─────────────────────────────────────────────────────
const RefinementSelection = ({ img1, img2, onSelect }) => (
  <div className="lobby-wrap" style={{ flexDirection:"column", position:"relative" }}>
    <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg4})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.08, filter:"sepia(0.5) brightness(0.6)", zIndex:0 }}/>
    <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", width:"100%" }}>
      <div className="phase-label" style={{ marginBottom:8 }}>⬡ CHOOSE YOUR BASE</div>
      <div className="phase-title" style={{ color:"var(--oracle-blue)", marginBottom:36 }}>Select the Foundation for Round 3</div>
      <div className="grid-2" style={{ gap:36, maxWidth:860, width:"100%" }}>
        {[{img:img1,label:"Round 1 Output"},{img:img2,label:"Round 2 Output"}].map(({img,label},i)=>(
          <div key={i} className="card" style={{ cursor:"pointer", padding:14, border:"1px solid var(--border-oracle)", transition:"all 0.3s" }}
            onClick={()=>onSelect(img)}
            onMouseOver={e=>e.currentTarget.style.boxShadow="0 0 30px rgba(0,212,255,0.2)"}
            onMouseOut={e=>e.currentTarget.style.boxShadow="none"}>
            <div className="card-title">{label}</div>
            <img src={img} style={{ width:"100%", borderRadius:4 }} alt={label}/>
            <button className="btn btn-oracle" style={{ width:"100%", justifyContent:"center", marginTop:14 }}>✓ Choose This</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── SUBMISSION FLOW ──────────────────────────────────────────────────────────
const SubmissionFlow = ({ images, onSelect }) => (
  <div className="lobby-wrap" style={{ flexDirection:"column", position:"relative" }}>
    <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg3})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.08, filter:"sepia(0.5) brightness(0.5)", zIndex:0 }}/>
    <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", width:"100%" }}>
      <div className="phase-label" style={{ marginBottom:8 }}>⬡ FINAL SUBMISSION</div>
      <div className="phase-title" style={{ color:"var(--rune-gold)", marginBottom:10 }}>Choose Your Final Vision</div>
      <div style={{ fontFamily:"'IM Fell English',serif", color:"var(--parchment-dim)", fontStyle:"italic", fontSize:15, marginBottom:36, textAlign:"center" }}>
        "Select the image that best captures the sacred vision. This is your final answer."
      </div>
      <div className="grid-3" style={{ gap:24, maxWidth:1000, width:"100%" }}>
        {images.map((img,i)=>(
          <div key={i} className="card" style={{ cursor:"pointer", padding:12, border:"1px solid var(--border-rune)", transition:"all 0.3s" }}
            onClick={()=>onSelect(img)}
            onMouseOver={e=>e.currentTarget.style.borderColor="var(--rune-gold)"}
            onMouseOut={e=>e.currentTarget.style.borderColor="var(--border-rune)"}>
            <div className="card-title">Round {i+1} Output</div>
            <img src={img} style={{ width:"100%", borderRadius:4 }} alt={`R${i+1}`}/>
            <button className="btn btn-gold" style={{ width:"100%", justifyContent:"center", marginTop:12, fontSize:11 }}>✓ Choose This</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── JUDGMENT VIEW ────────────────────────────────────────────────────────────
const JudgmentView = ({ score=78, originalImage, finalImage, onReturnToLobby }) => {
  const [disp, setDisp] = useState(0);
  const circ = 2*Math.PI*100;
  useEffect(()=>{let c=0;const step=score/80;const t=setInterval(()=>{c+=step;if(c>=score){setDisp(score);clearInterval(t);return;}setDisp(Math.round(c));},25);return()=>clearInterval(t);},[score]);
  const offset = circ-(disp/100)*circ;

  return (
    <div className="results-wrap" style={{ animation:"fadeInUp 0.8s ease-out", position:"relative" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg2})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.07, filter:"sepia(0.4) brightness(0.5)", zIndex:0, pointerEvents:"none" }}/>
      <div className="result-panel" style={{ position:"relative", zIndex:1 }}>
        <div className="result-label" style={{ color:"var(--rune-gold)" }}>⬡ THE ORIGINAL VISION</div>
        <div style={{ flex:1, border:"1px solid var(--border-rune)", borderRadius:4, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,var(--stone),var(--abyss))" }}>
          {originalImage
            ? <img src={originalImage} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt="original"/>
            : <div style={{ textAlign:"center", opacity:0.5 }}><div style={{ fontSize:56, marginBottom:10 }}>🖼️</div><div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, color:"var(--parchment-dim)" }}>ORIGINAL IMAGE</div></div>}
        </div>
      </div>

      <div style={{ width:"min(220px,40vw)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:"0 10px", position:"relative", zIndex:1 }}>
        <svg viewBox="0 0 220 220" width="min(180px,38vw)" height="min(180px,38vw)">
          <circle cx="110" cy="110" r="100" fill="none" stroke="var(--stone)" strokeWidth="8"/>
          <circle cx="110" cy="110" r="100" fill="none" stroke="var(--rune-gold)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 110 110)"
            style={{ transition:"stroke-dashoffset 0.1s ease-out", filter:"drop-shadow(0 0 8px var(--rune-gold))" }}/>
          <text x="110" y="100" textAnchor="middle" fill="var(--rune-gold)" fontFamily="'Cinzel Decorative',serif" fontSize="34" fontWeight="900">{disp}%</text>
          <text x="110" y="130" textAnchor="middle" fill="var(--parchment-dim)" fontFamily="'Share Tech Mono',monospace" fontSize="9" letterSpacing="2">SIMILARITY</text>
          <text x="110" y="148" textAnchor="middle" fill="var(--parchment-dim)" fontFamily="'Share Tech Mono',monospace" fontSize="9" letterSpacing="2">SCORE</text>
        </svg>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--parchment-dim)", letterSpacing:2, textAlign:"center" }}>THE ORACLE'S VERDICT</div>
        <div style={{ fontFamily:"'IM Fell English',serif", fontSize:13, color:"var(--parchment-dim)", fontStyle:"italic", textAlign:"center" }}>
          {disp>=80?"⭐ Masterful Vision":disp>=60?"✨ Strong Resonance":disp>=40?"🌀 Partial Alignment":"💨 The Vision was lost"}
        </div>
        <button className="btn btn-ghost" style={{ fontSize:11, marginTop:6 }} onClick={onReturnToLobby}>↩ Return to Sanctum</button>
      </div>

      <div className="result-panel" style={{ position:"relative", zIndex:1 }}>
        <div className="result-label" style={{ color:"var(--oracle-blue)" }}>⬡ THE GENERATED VISION</div>
        <div style={{ flex:1, border:"1px solid var(--border-oracle)", borderRadius:4, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,rgba(0,153,204,0.1),var(--abyss))" }}>
          {finalImage
            ? <img src={finalImage} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt="generated"/>
            : <div style={{ textAlign:"center", opacity:0.5 }}><div style={{ fontSize:56, marginBottom:10 }}>✨</div><div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, color:"var(--oracle-blue)" }}>GENERATED IMAGE</div></div>}
        </div>
      </div>
    </div>
  );
};

// ─── VICTORY SCREEN ───────────────────────────────────────────────────────────
const VictoryScreen = ({ winners, teamName }) => {
  const medals     = ["🥇","🥈","🥉"];
  const medalClass = ["gold","silver","bronze"];
  const myRank     = (winners||[]).findIndex(w=>w.name===teamName);
  return (
    <div className="victory-wrap" style={{ position:"relative" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bg2})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.12, filter:"sepia(0.3) brightness(0.5)", zIndex:0 }}/>
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:40, animation:"fadeInUp 0.8s ease-out" }}>
          <div style={{ fontSize:68, marginBottom:14, animation:"victoryGlow 2s infinite", display:"inline-block" }}>👑</div>
          <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"clamp(22px,5vw,36px)", color:"var(--rune-gold)", animation:"goldPulse 2s infinite", marginBottom:8 }}>The Oracle Has Spoken</div>
          <div style={{ fontFamily:"'IM Fell English',serif", fontSize:"clamp(14px,2.5vw,18px)", color:"var(--parchment-dim)", fontStyle:"italic" }}>
            "The labyrinth has been conquered. These visions shall be remembered forever."
          </div>
          {myRank>=0&&(
            <div style={{ marginTop:14, fontFamily:"'Share Tech Mono',monospace", fontSize:14, color:"var(--rune-gold)", letterSpacing:3 }}>
              YOUR TEAM PLACED: {medals[myRank]} #{myRank+1}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:28, justifyContent:"center", flexWrap:"wrap", maxWidth:1100, animation:"fadeInUp 0.8s ease-out" }}>
          {(winners||[]).map((w,i)=>(
            <div key={w.id||i} className={`winner-card ${medalClass[i]||""}`} style={{ flex:"1 1 280px", maxWidth:340 }}>
              <div style={{ textAlign:"center", marginBottom:18 }}>
                <div style={{ fontSize:44, marginBottom:8 }}>{medals[i]}</div>
                <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:17, color:"var(--rune-gold)" }}>{w.name}</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:"var(--parchment-dim)", marginTop:4 }}>{w.observer||"—"} & {w.creator||"—"}</div>
              </div>
              <div className="grid-2" style={{ gap:10, marginBottom:14 }}>
                {["ORIGINAL","GENERATED"].map((lbl,li)=>(
                  <div key={li}>
                    <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:"var(--parchment-dim)", marginBottom:5, letterSpacing:2 }}>{lbl}</div>
                    <div style={{ border:`1px solid ${li===0?"var(--border-rune)":"var(--border-oracle)"}`, borderRadius:3, overflow:"hidden", height:110, background:"var(--stone)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, opacity:0.6 }}>
                      {li===0?"🖼️":"✨"}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:26, color:"var(--oracle-blue)" }}>{w.score||0}%</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--parchment-dim)", letterSpacing:2 }}>SIMILARITY SCORE</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────
const PenaltyOverlay = ({ onDismiss }) => {
  useEffect(()=>{const t=setTimeout(onDismiss,4000);return()=>clearTimeout(t);},[onDismiss]);
  return (
    <>
      <div className="penalty-overlay"/>
      <div className="penalty-toast">⚡ PENALTY INVOKED BY THE ORACLE — TIME REDUCED BY 30 SECONDS</div>
    </>
  );
};

const DisqualificationScreen = () => {
  const runes=["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚹ","ᚺ","ᚾ","ᛁ","ᛃ"];
  return (
    <div className="disqual-screen" style={{ position:"relative" }}>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,#1a0000,#0d0000)", zIndex:0 }}/>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:1 }}>
        {runes.map((r,i)=><span key={i} style={{ position:"absolute", fontSize:22, color:"rgba(255,0,0,0.13)", animation:"runeFloat 3s ease-in-out infinite", animationDelay:`${i*0.3}s`, left:`${(i*7+5)%90}%`, top:`${(i*11+5)%90}%` }}>{r}</span>)}
      </div>
      <div style={{ textAlign:"center", position:"relative", zIndex:2 }}>
        <div style={{ fontSize:76, marginBottom:20 }}>☠️</div>
        <div className="disqual-title">DISQUALIFIED</div>
        <div style={{ fontFamily:"'IM Fell English',serif", fontSize:"clamp(14px,3vw,20px)", color:"rgba(255,100,100,0.7)", fontStyle:"italic" }}>"The Oracle has cast you from the labyrinth"</div>
        <div style={{ marginTop:18, fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:"rgba(255,100,100,0.4)", letterSpacing:3 }}>ANTI-CHEAT PROTOCOL · ADMIN NOTIFIED</div>
      </div>
    </div>
  );
};

// ─── PLAYER SECTION ───────────────────────────────────────────────────────────
const PlayerSection = ({ addAlert, globalTags, timers, allTeams, setTeams, winners }) => {
  // ── FIX: State recovery — restore session from localStorage on mount ──────
  const [phase, setPhaseRaw]            = useState(() => loadSession()?.phase || "lobby");
  const [playerInfo, setPlayerInfo]     = useState(() => loadSession()?.playerInfo || null);
  const [r1Image, setR1Image]           = useState(() => loadSession()?.r1Image || null);
  const [r2Image, setR2Image]           = useState(() => loadSession()?.r2Image || null);
  const [r3Image, setR3Image]           = useState(() => loadSession()?.r3Image || null);
  const [r3BaseImage, setR3BaseImage]   = useState(() => loadSession()?.r3BaseImage || null);
  const [finalImage, setFinalImage]     = useState(null);
  const [showPenalty, setShowPenalty]   = useState(false);
  const [disqualified, setDisqual]      = useState(false);
  const [showTabWarn, setShowTabWarn]   = useState(false);
  const [isActive, setIsActive]         = useState(() => loadSession()?.isActive || false);
  const [obsTimeLeft, setObsTimeLeft]   = useState(() => timers.round1||300);
  const [liveObsText, setLiveObsText]   = useState("");
  const [showSwapGate, setShowSwapGate] = useState(false);
  const [pendingPhase, setPendingPhase] = useState(null);
  const vc       = useRef(0);
  const myTeamId = useRef(() => loadSession()?.teamId || null);

  // Persist session whenever key state changes
  const setPhase = useCallback((p) => {
    setPhaseRaw(p);
    saveSession({ phase: p, playerInfo, r1Image, r2Image, r3Image, r3BaseImage, teamId: myTeamId.current, isActive });
  }, [playerInfo, r1Image, r2Image, r3Image, r3BaseImage, isActive]);

  // ── FIX: currentPlayer label per phase ────────────────────────────────────
  const getCurrentPlayer = () => {
    if (!playerInfo) return "";
    const obs = playerInfo.role==="observer" ? playerInfo.player1 : playerInfo.player2;
    const cre = playerInfo.role==="creator"  ? playerInfo.player1 : playerInfo.player2;
    if (["round1","round3"].includes(phase)) return obs + " (Observer)";
    if (phase === "round2") return cre + " (Creator)";
    return "";
  };

  // Admin events
  useEventListener((evt, payload) => {
    if (evt==="TEAM_APPROVED" && payload.teamId===myTeamId.current) {
      setIsActive(true);
      const startPhase = playerInfo?.role==="observer" ? "round1" : "waiting";
      setPhase(startPhase);
      setObsTimeLeft(timers.round1||300);
    }
    if (evt==="PENALTY_CAST"  && payload.teamId===myTeamId.current) setShowPenalty(true);
    if (evt==="TEAM_BANNED"   && payload.teamId===myTeamId.current) setDisqual(true);
  });

  const updateMyTeam = useCallback((u) =>
    setTeams(p => p.map(t => t.id===myTeamId.current ? {...t,...u} : t))
  , [setTeams]);

  const handleViolation = useCallback((type, msg, count) => {
    addAlert({ type, team:playerInfo?.teamName||"Unknown", message:msg, time:new Date().toLocaleTimeString() });
    updateMyTeam({ observerText: liveObsText });
    if (count >= 2 || type==="TAB_SWITCH") setDisqual(true);
    else setShowTabWarn(true);
  }, [playerInfo, addAlert, liveObsText, updateMyTeam]);

  useAntiCheat(isActive && !disqualified, phase, handleViolation);

  // ── FIX: team deduplication on register ─────────────────────────────────
  const handleLobbySubmit = (info) => {
    setPlayerInfo(info);
    const tid = Date.now();
    myTeamId.current = tid;

    // Remove any previous entries with the same team name (ghost cleanup)
    // and add the fresh entry
    const newTeam = {
      id: tid,
      name: info.teamName,
      observer: info.role==="observer" ? info.player1 : info.player2,
      creator:  info.role==="creator"  ? info.player1 : info.player2,
      round: 0, score: 0, status: "pending",
      timeLeft: timers.round1||300,
      totalTime: timers.round1||300,
      observerText: "", creatorText: "",
    };

    setTeams(prev => {
      // Remove ghosts: same name + status pending/banned (already finished) 
      const cleaned = prev.filter(t => !(t.name===info.teamName && (t.status==="pending"||t.status==="banned"||t.status==="approved")));
      return [...cleaned, newTeam];
    });

    setObsTimeLeft(timers.round1||300);
    saveSession({ phase:"lobby", playerInfo:info, r1Image:null, r2Image:null, r3Image:null, r3BaseImage:null, teamId:tid, isActive:false });
  };

  // ── Phase transitions with swap gate enforcement ──────────────────────────
  // Wrap round2 start with swap gate so Player 2 must confirm
  const goToRound2 = () => { setPendingPhase("round2"); setShowSwapGate(true); };
  const goToRound3 = () => { setPendingPhase("round3"); setShowSwapGate(true); };

  const confirmSwap = () => {
    setShowSwapGate(false);
    if (pendingPhase) setPhase(pendingPhase);
    setPendingPhase(null);
  };

  if (disqualified) return <DisqualificationScreen/>;
  if (showSwapGate) return (
    <SwapGate
      playerName={pendingPhase==="round2"
        ? (playerInfo?.role==="creator" ? playerInfo?.player1 : playerInfo?.player2)
        : (playerInfo?.role==="observer" ? playerInfo?.player1 : playerInfo?.player2)
      }
      title={pendingPhase==="round2" ? "Creator's Turn" : "Observer Returns"}
      subtitle={`Enter the PIN to confirm the player swap`}
      onConfirm={confirmSwap}
    />
  );

  const myTeamScore = allTeams.find(t=>t.id===myTeamId.current)?.score || 0;

  return (
    <div className="player-shell">
      {showTabWarn && (
        <div className="tab-warning" style={{ animation:"toastSlide 5s ease-out forwards" }} onAnimationEnd={()=>setShowTabWarn(false)}>
          🚨 WARNING: Page exit detected and reported to the Oracle. Next violation = DISQUALIFICATION.
        </div>
      )}
      {showPenalty && <PenaltyOverlay onDismiss={()=>setShowPenalty(false)}/>}

      {/* Top bar */}
      <div style={{ position:"fixed", top:0, left:0, right:0, height:44, background:"rgba(4,5,10,0.97)", borderBottom:"1px solid var(--border-rune)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", zIndex:200, flexWrap:"wrap", gap:6 }}>
        <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:16, color:"var(--rune-gold)", animation:"goldPulse 3s infinite" }}>MAYAVYUH</div>
        <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
          {playerInfo && <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:"var(--parchment-dim)" }}>⬡ {playerInfo.teamName}</span>}
          <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--oracle-blue)", letterSpacing:2 }}>
            {getCurrentPlayer() || phase.replace("round","ROUND ").replace("interval","INTERVAL ").toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ paddingTop:44, minHeight:"100vh", position:"relative", zIndex:2 }}>
        {phase==="lobby" && <Lobby onSubmit={handleLobbySubmit}/>}

        {phase==="waiting" && (
          <WaitingLobby
            teamName={playerInfo?.teamName}
            otherTeams={allTeams}
            observerName={playerInfo?.role==="creator" ? (playerInfo?.player1||"Observer") : (playerInfo?.player2||"Observer")}
            observerTimerMax={timers.round1||300}
            observerTimeLeft={obsTimeLeft}
            observerText={liveObsText}
            winners={winners}
          />
        )}

        {/* ROUND 1 — Observer */}
        {phase==="round1" && (
          <GeminiUI
            forbiddenWords={globalTags}
            timerDuration={timers.round1||300}
            isRefining={false}
            roundLabel="ROUND 1 · OBSERVER GENERATES"
            currentPlayer={getCurrentPlayer()}
            bgImage={bg3}
            onSelect={img => {
              setR1Image(img);
              updateMyTeam({ round:1, status:"active" });
              saveSession({ phase:"interval1", playerInfo, r1Image:img, r2Image, r3Image, r3BaseImage, teamId:myTeamId.current, isActive });
              setPhase("interval1");
            }}
            onTextChange={t => { setLiveObsText(t); updateMyTeam({ observerText:t }); }}
          />
        )}

        {phase==="interval1" && (
          <DiscussionInterval
            onComplete={() => { saveSession({ phase:"swapgate2", playerInfo, r1Image, r2Image, r3Image, r3BaseImage, teamId:myTeamId.current, isActive }); goToRound2(); }}
            duration={timers.discussion||120}
          />
        )}

        {/* ROUND 2 — Creator */}
        {phase==="round2" && (
          <GeminiUI
            forbiddenWords={globalTags}
            timerDuration={timers.round2||300}
            isRefining={true}
            imagesToRefine={[r1Image||"https://picsum.photos/seed/r1ref/400/400"]}
            roundLabel="ROUND 2 · CREATOR REFINES"
            currentPlayer={getCurrentPlayer()}
            bgImage={bg4}
            onSelect={img => {
              setR2Image(img);
              updateMyTeam({ round:2, creatorText:"" });
              saveSession({ phase:"interval2", playerInfo, r1Image, r2Image:img, r3Image, r3BaseImage, teamId:myTeamId.current, isActive });
              setPhase("interval2");
            }}
            onTextChange={t => updateMyTeam({ creatorText:t })}
          />
        )}

        {phase==="interval2" && (
          <SwapInterval
            onComplete={() => { saveSession({ phase:"r3select", playerInfo, r1Image, r2Image, r3Image, r3BaseImage, teamId:myTeamId.current, isActive }); setPhase("r3select"); }}
            duration={timers.swap||60}
            swapTo={playerInfo?.role==="observer" ? playerInfo?.player1 : playerInfo?.player2}
          />
        )}

        {phase==="r3select" && (
          <RefinementSelection
            img1={r1Image||"https://picsum.photos/seed/r1sel/400/400"}
            img2={r2Image||"https://picsum.photos/seed/r2sel/400/400"}
            onSelect={img => { setR3BaseImage(img); saveSession({ phase:"round3", playerInfo, r1Image, r2Image, r3Image, r3BaseImage:img, teamId:myTeamId.current, isActive }); goToRound3(); }}
          />
        )}

        {/* ROUND 3 — Observer returns */}
        {phase==="round3" && (
          <GeminiUI
            forbiddenWords={globalTags}
            timerDuration={timers.round3||300}
            isRefining={true}
            imagesToRefine={[r3BaseImage||"https://picsum.photos/seed/r3base/400/400"]}
            roundLabel="ROUND 3 · FINAL REFINEMENT"
            currentPlayer={getCurrentPlayer()}
            bgImage={bg5}
            onSelect={img => {
              setR3Image(img);
              updateMyTeam({ round:3 });
              saveSession({ phase:"submission", playerInfo, r1Image, r2Image, r3Image:img, r3BaseImage, teamId:myTeamId.current, isActive });
              setPhase("submission");
            }}
            onTextChange={t => updateMyTeam({ observerText:t })}
          />
        )}

        {phase==="submission" && (
          <SubmissionFlow
            images={[
              r1Image||"https://picsum.photos/seed/sub1/400/400",
              r2Image||"https://picsum.photos/seed/sub2/400/400",
              r3Image||"https://picsum.photos/seed/sub3/400/400",
            ]}
            onSelect={img => {
              setFinalImage(img);
              const sc = Math.floor(Math.random()*40+55);
              updateMyTeam({ score:sc, status:"active", finalImage:img });
              clearSession(); // clear after submission — game complete
              setPhase("judgment");
            }}
          />
        )}

        {phase==="judgment" && (
          <JudgmentView
            score={myTeamScore||Math.floor(Math.random()*40+55)}
            originalImage="https://picsum.photos/seed/mayatarget/400/400"
            finalImage={finalImage}
            onReturnToLobby={() => setPhase("waiting")}
          />
        )}
      </div>

      {/* Dev controls — remove before production */}
      {isActive && (
        <div style={{ position:"fixed", bottom:16, right:16, zIndex:300, display:"flex", gap:5, flexDirection:"column" }}>
          <button className="btn btn-ghost" style={{ fontSize:10, padding:"4px 10px", borderColor:"var(--oracle-blue)", color:"var(--oracle-blue)" }}
            onClick={()=>{
              const flow=["round1","interval1","round2","interval2","r3select","round3","submission","judgment","waiting"];
              setPhaseRaw(p=>{ const i=flow.indexOf(p); return flow[Math.min(i+1,flow.length-1)]; });
            }}>
            [DEV] NEXT →
          </button>
          <button className="btn btn-ghost" style={{ fontSize:10, padding:"4px 10px", borderColor:"var(--blood-red)", color:"var(--blood-glow)" }}
            onClick={()=>setShowPenalty(true)}>
            [DEV] PENALTY
          </button>
          <button className="btn btn-ghost" style={{ fontSize:10, padding:"4px 10px", borderColor:"#ffc800", color:"#ffc800" }}
            onClick={()=>{ setIsActive(true); setPhase("round1"); }}>
            [DEV] SKIP APPROVAL
          </button>
        </div>
      )}
    </div>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const getView = () => {
    const h = window.location.hash;
    if (h==="#admin")  return "admin";
    if (h==="#player") return "player";
    return "landing";
  };
  const [view, setView] = useState(getView);

  useEffect(() => {
    const h = () => setView(getView());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const nav = (v) => { window.location.hash = v==="landing" ? "" : v; setView(v); };

  // All shared state at root
  const [teams, setTeams]             = useSyncState("maya_teams",   INIT_TEAMS);
  const [forbiddenWords, setForbWords]= useSyncState("maya_words",   INIT_WORDS);
  const [timers, setTimersRaw]        = useSyncState("maya_timers",  INIT_TIMERS);
  const [alerts, setAlerts]           = useSyncState("maya_alerts",  []);
  const [winners, setWinners]         = useSyncState("maya_winners", []);
  const [eventState, setEventState]   = useSyncState("maya_event",   INIT_EVENT);

  const addForbiddenWord    = useCallback(w=>setForbWords(p=>[...p.filter(x=>x!==w),w]),[setForbWords]);
  const removeForbiddenWord = useCallback(w=>setForbWords(p=>p.filter(x=>x!==w)),[setForbWords]);
  const updateTimers        = useCallback((round,secs)=>setTimersRaw(p=>({...p,[round]:secs})),[setTimersRaw]);
  const addAlert            = useCallback(a=>setAlerts(p=>[a,...p.slice(0,49)]),[setAlerts]);

  return (
    <>
      <GlobalStyles/>
      <SceneWrapper>
        {view==="landing" && <LandingPage onSelect={role=>nav(role)}/>}
        {view==="admin"  && (
          <AdminDashboard
            alerts={alerts} setAlerts={setAlerts}
            teams={teams} setTeams={setTeams}
            forbiddenWords={forbiddenWords}
            addForbiddenWord={addForbiddenWord}
            removeForbiddenWord={removeForbiddenWord}
            timers={timers} updateTimers={updateTimers}
            winners={winners} setWinners={setWinners}
            eventState={eventState} setEventState={setEventState}
          />
        )}
        {view==="player" && (
          <PlayerSection
            addAlert={addAlert}
            globalTags={forbiddenWords}
            timers={timers}
            allTeams={teams}
            setTeams={setTeams}
            winners={winners}
          />
        )}
      </SceneWrapper>
    </>
  );
}