import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, User, Users, Crosshair } from "lucide-react";
import { useSyncState, broadcastEvent, useEventListener } from "./useSync.js";
import { AdminDashboard, SceneWrapper, GlobalStyles, BG_IMAGES } from "./AdminComponents.jsx";
import gdgLogo from "./assets/gdg-logo.png";
const INIT_TEAMS = [];
const INIT_EVENT = { started: false, phase: "lobby" };

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

const RegistrationScreen = ({ onRegister }) => {
  const [teamName, setTeamName] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  const handleRegister = (e) => {
    e.preventDefault();
    if (!teamName || !p1 || !p2) return;
    const teamId = Date.now().toString();
    onRegister({ id: teamId, name: teamName, player1: p1, player2: p2, status: "active", round: 0 });
  };

  return (
    <div className="imperial-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: "150vw", height: "150vh", background: "radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 50%)", animation: "pulse 4s infinite alternate" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 800, height: 800, border: "1px dashed rgba(212, 175, 55, 0.1)", borderRadius: "50%", animation: "spin-slow 30s linear infinite" }} />
      
      <div style={{ display: "flex", width: "100%", maxWidth: 1200, gap: 64, alignItems: "center", zIndex: 10, padding: 32 }}>
        <div style={{ flex: 1, paddingRight: 40, animation: "float 6s ease-in-out infinite" }}>
          <img src={gdgLogo} alt="GDG Logo" style={{ width: 120, marginBottom: 24, filter: "drop-shadow(0 0 20px rgba(212,175,55,0.4))", borderRadius: "50%", background: "rgba(255,255,255,0.05)", padding: 8 }} />
          <div style={{ fontFamily: "'Cinzel', serif", color: "#D4AF37", letterSpacing: 8, marginBottom: 16, fontSize: 14 }}>⬡ PROJECT: MAYAVYUH ⬡</div>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "5rem", lineHeight: 1.1, marginBottom: 20, color: "#fff", textShadow: "0 0 30px rgba(212,175,55,0.6)" }}>THE PROMPT WAR</div>
          <div style={{ fontFamily: "'Cinzel', serif", color: "rgba(255,255,255,0.6)", fontSize: 18, maxWidth: 500, lineHeight: 1.8, letterSpacing: 2 }}>
            Enter the labyrinth. Describe the vision. Generate the spell. Two minds, one prompt.
          </div>
        </div>

        <motion.div style={{ flex: 1, maxWidth: 450 }} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
          <form onSubmit={handleRegister} className="imperial-glass imperial-panel" style={{ textAlign: "center", padding: "48px 40px", border: "1px solid rgba(212, 175, 55, 0.3)", boxShadow: "0 0 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(212, 175, 55, 0.1)" }}>
            <Shield size={48} color="#D4AF37" style={{ margin: "0 auto", marginBottom: 24, filter: "drop-shadow(0 0 10px rgba(212,175,55,0.4))" }} />
            <div className="imperial-gold-text" style={{ fontFamily: "'Cinzel', serif", fontSize: 24, marginBottom: 8, letterSpacing: 4 }}>TEAM ENLISTMENT</div>
            <div style={{ color: "rgba(212, 175, 55, 0.5)", fontSize: 10, letterSpacing: 4, marginBottom: 32 }}>INITIATE DATACRON UPLINK</div>
            
            <div style={{ position: "relative", marginBottom: 24 }}>
              <Users size={16} color="#D4AF37" style={{ position: "absolute", top: 18, left: 20, opacity: 0.6 }} />
              <input 
                placeholder="TEAM DESIGNATION" 
                value={teamName} 
                onChange={e=>setTeamName(e.target.value.toUpperCase())} 
                required 
                style={{ width: "100%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(212, 175, 55, 0.3)", padding: "16px 24px 16px 54px", color: "#D4AF37", fontSize: 14, outline: "none", letterSpacing: 4, fontFamily: "'Orbitron', sans-serif", transition: "all 0.3s" }} 
                onFocus={(e) => e.target.style.borderColor = "#D4AF37"}
                onBlur={(e) => e.target.style.borderColor = "rgba(212, 175, 55, 0.3)"}
              />
            </div>
            
            <div style={{ position: "relative", marginBottom: 24 }}>
              <User size={16} color="#D4AF37" style={{ position: "absolute", top: 18, left: 20, opacity: 0.6 }} />
              <input 
                placeholder="OPERATIVE 01 NAME" 
                value={p1} 
                onChange={e=>setP1(e.target.value.toUpperCase())} 
                required 
                style={{ width: "100%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(212, 175, 55, 0.3)", padding: "16px 24px 16px 54px", color: "#D4AF37", fontSize: 14, outline: "none", letterSpacing: 4, fontFamily: "'Orbitron', sans-serif", transition: "all 0.3s" }} 
                onFocus={(e) => e.target.style.borderColor = "#D4AF37"}
                onBlur={(e) => e.target.style.borderColor = "rgba(212, 175, 55, 0.3)"}
              />
            </div>

            <div style={{ position: "relative", marginBottom: 40 }}>
              <User size={16} color="#D4AF37" style={{ position: "absolute", top: 18, left: 20, opacity: 0.6 }} />
              <input 
                placeholder="OPERATIVE 02 NAME" 
                value={p2} 
                onChange={e=>setP2(e.target.value.toUpperCase())} 
                required 
                style={{ width: "100%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(212, 175, 55, 0.3)", padding: "16px 24px 16px 54px", color: "#D4AF37", fontSize: 14, outline: "none", letterSpacing: 4, fontFamily: "'Orbitron', sans-serif", transition: "all 0.3s" }} 
                onFocus={(e) => e.target.style.borderColor = "#D4AF37"}
                onBlur={(e) => e.target.style.borderColor = "rgba(212, 175, 55, 0.3)"}
              />
            </div>

            <button type="submit" className="btn-imperial" style={{ width: "100%", padding: 20, letterSpacing: 4, fontSize: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
              INITIALIZE CONNECTION <Crosshair size={16} />
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

const LobbyScreen = () => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
    <img src={gdgLogo} alt="GDG Logo" style={{ width: 80, marginBottom: 24, animation: "pulse 2s infinite" }} />
    <div style={{ fontSize: 64, animation: "pulse 2s infinite" }}>⏳</div>
    <div className="title-primary" style={{ marginTop: 24, fontSize: 32 }}>AWAITING OVERRIDE</div>
    <div style={{ fontFamily: "'Share Tech Mono'", color: "var(--text-dim)", marginTop: 16, fontSize: 18 }}>Waiting for Admin to start the event...</div>
  </div>
);

const IntervalScreen = ({ title, message, timeLeft }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, padding: 24, textAlign: "center" }}>
    <img src={gdgLogo} alt="GDG Logo" style={{ width: 60, marginBottom: 20 }} />
    <div style={{ fontSize: 64, marginBottom: 24 }}>🔀</div>
    <div className="title-primary" style={{ fontSize: 40, color: "var(--neon-gold)", textShadow: "0 0 10px var(--neon-gold)" }}>{title}</div>
    <div style={{ fontFamily: "'Share Tech Mono'", color: "var(--text-main)", fontSize: 20, maxWidth: 600, margin: "24px 0", lineHeight: 1.6 }}>{message}</div>
    {timeLeft > 0 && <div style={{ fontSize: 48, fontFamily: "'Orbitron'", color: "#D4AF37", marginBottom: 32 }}>{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</div>}
    <div style={{ fontFamily: "'Cinzel', serif", color: "var(--neon-cyan)", letterSpacing: 4 }}>AWAITING PROTOCOL...</div>
  </div>
);

const RoundDisplay = ({ playerLabel, targetImage, onComplete, roundLabel, storageKey, isPaused, timeLeft, isRoundEnded }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedImgUrl, setUploadedImgUrl] = useState(null);
  const [isGeminiLaunched, setIsGeminiLaunched] = useState(false);
  const [geminiLink, setGeminiLink] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fmtTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const handleOpenGemini = () => {
    const sw = window.screen.availWidth;
    const sh = window.screen.availHeight;
    const half = Math.floor(sw / 2);

    // Open Gemini on the right half
    window.open('https://gemini.google.com', 'GeminiPopup', `width=${half},height=${sh},left=${half},top=0`);
    
    // Attempt to resize current window to the left half
    try {
      window.moveTo(0, 0);
      window.resizeTo(half, sh);
    } catch (e) {
      console.warn("Browser blocked window resize", e);
    }
    
    setIsGeminiLaunched(true);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const uploadRes = await fetch("https://mayavyuh.onrender.com/api/upload", { method: "POST", body: formData });
      const { url } = await uploadRes.json();
      setUploadedImgUrl("https://mayavyuh.onrender.com" + url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!geminiLink.trim()) {
      alert("SECURITY LOCK: You must paste your Gemini Chat Link to verify this spell.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("https://mayavyuh.onrender.com/api/verify-gemini", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: geminiLink })
      });
      const data = await res.json();
      if (!res.ok) {
        alert("LOCK REJECTED: " + (data.error || "Verification failed."));
        return;
      }
      onComplete(uploadedImgUrl, geminiLink);
    } catch(err) {
      alert("Error verifying the Gemini link.");
    } finally {
      setVerifying(false);
    }
  };

  if (isGeminiLaunched) {
    return (
      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: "50vw", padding: "32px 40px", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
        
        {/* Header Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, fontFamily: "'Orbitron'", color: isPaused ? "#ff2a2a" : "#D4AF37", textShadow: `0 0 10px ${isPaused ? 'rgba(255,42,42,0.5)' : 'rgba(212,175,55,0.5)'}`, letterSpacing: 2 }}>
            {fmtTime(timeLeft)}
          </div>
          <div className="title-secondary" style={{ marginBottom: 0, border: "none", fontSize: 24, letterSpacing: 2, color: "var(--neon-cyan)" }}>
            {roundLabel}
          </div>
        </div>
        
        {/* Main Panel */}
        <motion.div layout className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px", width: "100%", maxWidth: "800px", margin: "0 auto", boxSizing: "border-box" }}>
           <div className="title-secondary" style={{ marginBottom: 24, fontSize: 20 }}>TARGET DATACRON</div>
           
           {targetImage ? (
              <motion.div layout style={{ width: "100%", flex: 1, minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 16, border: "1px solid rgba(255,255,255,0.1)", marginBottom: 24 }}>
                <motion.img layoutId="target-image" src={targetImage} alt="target" style={{ maxWidth: "100%", maxHeight: "50vh", objectFit: "contain", borderRadius: 4, boxShadow: "0 0 20px rgba(0,0,0,0.5)" }} />
              </motion.div>
           ) : (
              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-dim)", fontFamily: "'Orbitron'" }}>NO TARGET</div>
           )}

           {!uploadedImgUrl ? (
              <motion.label layout style={{ width: "100%", cursor: uploading ? "not-allowed" : "pointer" }}>
                <div style={{ width: "100%", padding: "16px", border: "1px solid rgba(0, 255, 255, 0.3)", borderRadius: 8, background: "rgba(0,0,0,0.6)", textAlign: "center", transition: "all 0.3s", boxShadow: "inset 0 0 10px rgba(0, 255, 255, 0.05)" }}>
                  <span style={{ color: uploading ? "var(--text-dim)" : "var(--neon-cyan)", fontSize: 16, letterSpacing: 2, fontFamily: "'Orbitron'", fontWeight: "bold" }}>
                    {uploading ? "UPLOADING ARTIFACT..." : "UPLOAD GENERATED IMAGE"}
                  </span>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
                </div>
              </motion.label>
           ) : (
              <motion.div layout style={{ width: "100%" }}>
                <div className="title-secondary" style={{ marginBottom: 16, fontSize: 16 }}>REVIEW SPELL</div>
                <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 16, border: "1px solid rgba(212, 175, 55, 0.4)", marginBottom: 24 }}>
                  <img src={uploadedImgUrl} alt="generated preview" style={{ maxWidth: "100%", maxHeight: "30vh", objectFit: "contain", borderRadius: 4 }} />
                </div>
                
                <div style={{ width: "100%", marginBottom: 16 }}>
                  <div style={{ color: "var(--neon-cyan)", fontSize: 12, marginBottom: 8, letterSpacing: 2 }}>GEMINI CHAT LINK:</div>
                  <input type="url" placeholder="https://gemini.google.com/app/6c03e86xxxxxxxx3" value={geminiLink} onChange={e=>setGeminiLink(e.target.value)} style={{ width: "100%", padding: "16px", background: "rgba(0,0,0,0.5)", border: "1px solid var(--neon-cyan)", color: "#fff", fontFamily: "'Share Tech Mono'", outline: "none", borderRadius: 4 }} />
                </div>
                
                <div style={{ display: "flex", gap: 16 }}>
                  <button className="btn-imperial-danger" style={{ flex: 1, padding: 16 }} onClick={() => setUploadedImgUrl(null)}>RETRY</button>
                  <button className="btn-imperial" style={{ flex: 2, padding: 16, borderColor: "var(--neon-green)", color: "var(--neon-green)", opacity: verifying ? 0.5 : 1 }} onClick={handleSubmit} disabled={verifying}>
                    {verifying ? "VERIFYING..." : "SUBMIT TO DATACRON ➔"}
                  </button>
                </div>
              </motion.div>
           )}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div layout className="chat-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <img src={gdgLogo} alt="GDG Logo" style={{ width: 40 }} />
          <div className="title-secondary" style={{ marginBottom: 0, border: "none" }}>{roundLabel}</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono'", color: "var(--neon-cyan)", marginBottom: 24, fontSize: 14 }}>{playerLabel} IS AT THE TERMINAL</div>
        
        <div style={{ textAlign: "center", marginBottom: 24, background: "rgba(0,0,0,0.5)", padding: 16, border: "1px solid rgba(212,175,55,0.2)" }}>
          <div style={{ fontSize: 32, fontFamily: "'Orbitron'", color: isPaused ? "#ff2a2a" : "#D4AF37", textShadow: `0 0 10px ${isPaused ? 'rgba(255,42,42,0.5)' : 'rgba(212,175,55,0.5)'}` }}>
            {fmtTime(timeLeft)}
          </div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: isPaused ? "#ff2a2a" : "rgba(212,175,55,0.6)" }}>
            {isPaused ? "TEMPORAL HALT" : "TIME REMAINING"}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ color: "var(--text-dim)", marginBottom: 8, fontSize: 14 }}>TARGET DATACRON:</div>
          <motion.div layout className="glass-panel" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, maxHeight: 400, overflow: "hidden" }}>
            {targetImage ? <motion.img layoutId="target-image" src={targetImage} alt="target" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ color: "var(--text-dim)", fontFamily: "'Orbitron'" }}>NO TARGET</div>}
          </motion.div>
        </div>
      </div>

      {/* Main Action Area */}
      <motion.div layout className="chat-main" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
        {isRoundEnded ? (
          <div style={{ textAlign: "center" }}>
             <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
             <div style={{ fontFamily: "'Orbitron'", fontSize: 24, color: "var(--neon-red)" }}>PHASE SEALED</div>
             <div style={{ color: "var(--text-dim)", marginTop: 16 }}>This phase has been closed by the Admin.</div>
          </div>
        ) : isPaused ? (
          <div style={{ textAlign: "center" }}>
             <div style={{ fontSize: 64, marginBottom: 16 }}>⏸️</div>
             <div style={{ fontFamily: "'Orbitron'", fontSize: 24, color: "#ff2a2a" }}>DATACRON PAUSED</div>
             <div style={{ color: "var(--text-dim)", marginTop: 16 }}>Wait for the Admin to resume the phase.</div>
          </div>
        ) : (
          <div className="glass-panel" style={{ width: "100%", maxWidth: 600, textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>✨</div>
            <div style={{ fontFamily: "'Orbitron'", fontSize: 24, color: "var(--neon-gold)", marginBottom: 16 }}>SPELL GENERATION</div>
            <div style={{ color: "var(--text-dim)", marginBottom: 32, lineHeight: 1.6 }}>
              Launch Gemini in Split-Screen Mode to generate your spell.<br/>
              Your target image will remain visible here.
            </div>
            
            <button className="btn-imperial" onClick={handleOpenGemini} style={{ width: "100%", padding: 20, fontSize: 16, display: "flex", justifyContent: "center", gap: 12 }}>
              LAUNCH GEMINI (SPLIT SCREEN) ➔
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const SelectionScreen = ({ imgR2, imgR3, onSelect }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", zIndex: 1 }}>
    <img src={gdgLogo} alt="GDG Logo" style={{ width: 60, marginBottom: 20 }} />
    <div className="title-primary" style={{ marginBottom: 16 }}>FINAL SELECTION</div>
    <div style={{ fontFamily: "'Share Tech Mono'", color: "var(--text-dim)", marginBottom: 40, fontSize: 18 }}>CHOOSE THE IMAGE THAT BEST MATCHES THE TARGET</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, width: "100%", maxWidth: 1000 }}>
      <div className="glass-panel" style={{ textAlign: "center" }}>
        <div className="title-secondary">ROUND 2 OUTPUT</div>
        <img src={imgR2} alt="R2" style={{ width: "100%", aspectRatio: "1/1", objectFit: "contain", marginBottom: 24, borderRadius: 6 }} />
        <button className="btn" onClick={() => onSelect(imgR2)}>SELECT THIS</button>
      </div>
      <div className="glass-panel" style={{ textAlign: "center" }}>
        <div className="title-secondary">ROUND 3 OUTPUT</div>
        <img src={imgR3} alt="R3" style={{ width: "100%", aspectRatio: "1/1", objectFit: "contain", marginBottom: 24, borderRadius: 6 }} />
        <button className="btn" onClick={() => onSelect(imgR3)}>SELECT THIS</button>
      </div>
    </div>
  </div>
);

const JudgmentScreen = ({ originalImg, finalImg, score, onFinish }) => {
  const [timeLeft, setTimeLeft] = useState(50);
  
  useEffect(() => {
    if (timeLeft <= 0) {
      onFinish();
      return;
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, onFinish]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", zIndex: 1 }}>
      <img src={gdgLogo} alt="GDG Logo" style={{ width: 80, marginBottom: 20 }} />
      <div className="title-primary" style={{ marginBottom: 20, color: "var(--neon-gold)", textShadow: "0 0 20px var(--neon-gold)", animation: "pulse 2s infinite" }}>SIMILARITY RESULTS</div>
      <div style={{ fontFamily: "'Orbitron'", color: "var(--neon-cyan)", fontSize: 24, marginBottom: 40, letterSpacing: 4 }}>
        PROCEEDING IN {timeLeft}S
      </div>
      
      <div style={{ display: "flex", gap: 60, alignItems: "center", width: "100%", maxWidth: 1200, perspective: 1000 }}>
        <div className="glass-panel cinematic-card" style={{ flex: 1, textAlign: "center", transform: "rotateY(10deg)" }}>
          <div className="title-secondary">TARGET DATACRON</div>
          <img src={originalImg} alt="orig" style={{ width: "100%", aspectRatio: "1/1", objectFit: "contain", borderRadius: 8, boxShadow: "0 0 30px rgba(0,0,0,0.8)" }} />
        </div>
        <div style={{ width: 260, textAlign: "center", animation: "float 4s infinite" }}>
          <div style={{ fontSize: 80, fontFamily: "'Orbitron'", color: "var(--neon-gold)", textShadow: "0 0 30px var(--neon-gold)", fontWeight: 900 }}>{score ? `${score.toFixed(1)}%` : "..."}</div>
          <div style={{ fontFamily: "'Share Tech Mono'", color: "var(--text-dim)", letterSpacing: 8, fontSize: 18 }}>SYNCHRONIZATION</div>
        </div>
        <div className="glass-panel cinematic-card" style={{ flex: 1, textAlign: "center", transform: "rotateY(-10deg)" }}>
          <div className="title-secondary">GENERATED SPELL</div>
          <img src={finalImg} alt="final" style={{ width: "100%", aspectRatio: "1/1", objectFit: "contain", borderRadius: 8, boxShadow: "0 0 30px rgba(0,0,0,0.8)" }} />
        </div>
      </div>
    </div>
  );
};

const LeaderboardRedirect = ({ teams }) => {
  const sorted = [...teams].filter(t => t.score).sort((a,b) => b.score - a.score).slice(0, 3);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
      <img src={gdgLogo} alt="GDG Logo" style={{ width: 80, marginBottom: 20 }} />
      <div className="title-primary" style={{ marginBottom: 40 }}>FINAL LEADERBOARD</div>
      <div className="glass-panel" style={{ width: 600 }}>
        {sorted.map((t, i) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: i < 2 ? "1px solid var(--glass-border)" : "none", fontSize: 24, fontFamily: "'Orbitron'" }}>
            <div style={{ color: i===0 ? "var(--neon-gold)" : i===1 ? "silver" : "#cd7f32" }}>#{i+1} {t.name}</div>
            <div style={{ color: "var(--neon-cyan)" }}>{t.score ? t.score.toFixed(1) : 0}%</div>
          </div>
        ))}
        {sorted.length === 0 && <div style={{ textAlign: "center", color: "var(--text-dim)", fontFamily: "'Share Tech Mono'" }}>NO TEAMS HAVE COMPLETED THE TRIAL YET</div>}
      </div>
    </div>
  );
};

const PlayerSection = ({ globalTeams, setGlobalTeams, eventState }) => {
  const [myTeam, setMyTeam] = useState(() => {
    try { const t = localStorage.getItem("maya_my_team"); return t ? JSON.parse(t) : null; } catch { return null; }
  });
  useEffect(() => {
    if (myTeam) localStorage.setItem("maya_my_team", JSON.stringify(myTeam));
  }, [myTeam]);

  const [phase, setPhase] = usePersistentState("maya_phase", "register"); // register, lobby, r1, interval1, r2, wait_for_r3, r3, select, judgment, leaderboard
  const [targetImage, setTargetImage] = usePersistentState("maya_targetImage", null);
  const [r1Img, setR1Img] = usePersistentState("maya_r1Img", null);
  const [r2Img, setR2Img] = usePersistentState("maya_r2Img", null);
  const [r3Img, setR3Img] = usePersistentState("maya_r3Img", null);
  const [finalImg, setFinalImg] = usePersistentState("maya_finalImg", null);
  const [score, setScore] = usePersistentState("maya_score", null);

  const [session, setSession] = useState(null);
  
  useEffect(() => {
    if (!myTeam) return;
    const fetchSession = async () => {
      try {
        const res = await fetch('https://mayavyuh.onrender.com/api/game/status');
        const data = await res.json();
        if (data.session) setSession(data.session);
      } catch (err) {}
    };
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [myTeam]);
  useEffect(() => {
    if (!session || !myTeam) return;
    const s = session.status;
    
    if (s === 'waiting' && phase !== 'lobby' && phase !== 'register') {
      setPhase("lobby");
    }
    else if (s === 'round1_active' && phase === 'lobby') {
      fetch("https://mayavyuh.onrender.com/api/target-image")
        .then(r=>r.json())
        .then(d=>{ setTargetImage(d.url); setPhase("r1"); })
        .catch(e=>setPhase("r1"));
    }
    else if (s === 'round2_active' && phase === 'interval1') {
      setPhase("r2");
    }
    else if (s === 'round3_active' && (phase === 'interval1' || phase === 'r2' || phase === 'wait_for_r3')) {
      setPhase("r3");
    }
    else if (s === 'finished' && phase !== 'leaderboard') {
      setPhase("leaderboard");
    }
  }, [session?.status, myTeam, phase, setPhase, setTargetImage]);

  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!session?.roundEndTime) { setTimeLeft(0); return; }
    const tick = () => {
      if (session.isPaused && session.timeRemainingAtPause != null) {
        setTimeLeft(Math.floor(session.timeRemainingAtPause / 1000));
      } else {
        setTimeLeft(Math.max(0, Math.floor((new Date(session.roundEndTime) - Date.now()) / 1000)));
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.roundEndTime, session?.isPaused, session?.timeRemainingAtPause]);
  useEffect(() => {
    if (myTeam && phase === "register") {
      setPhase("lobby");
    }
  }, [myTeam, phase, setPhase]);
  useEventListener((eventType) => {
    if (eventType === "GLOBAL_RESET") {
      localStorage.removeItem("maya_my_team");
      localStorage.removeItem("maya_phase");
      localStorage.removeItem("maya_targetImage");
      localStorage.removeItem("maya_r1Img");
      localStorage.removeItem("maya_r2Img");
      localStorage.removeItem("maya_r3Img");
      localStorage.removeItem("maya_finalImg");
      localStorage.removeItem("maya_score");
      window.location.reload();
    }
  });

  const handleRegister = (t) => {
    setTargetImage(null);
    setR1Img(null);
    setR2Img(null);
    setR3Img(null);
    setFinalImg(null);
    setScore(null);
    
    setMyTeam(t);
    setGlobalTeams(prev => [...prev, t]);
    setPhase("lobby");
  };

  const updateTeamStatus = (updates) => {
    setGlobalTeams(prev => prev.map(t => t.id === myTeam.id ? { ...t, ...updates } : t));
  };

  if (!myTeam) return <RegistrationScreen onRegister={handleRegister} />;
  
  const currentTeamState = globalTeams.find(t => t.id === myTeam?.id);
  if (currentTeamState?.status === "banned") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>☠️</div>
        <div className="title-primary" style={{ color: "var(--neon-red)" }}>BANNED</div>
        <div style={{ fontFamily: "'Share Tech Mono'", color: "var(--neon-red)", marginTop: 16 }}>YOUR TEAM HAS BEEN REMOVED FROM THE TRIAL</div>
      </div>
    );
  }

  const isPaused = session?.isPaused || false;
  const status = session?.status || 'waiting';

  if (phase === "lobby") return <LobbyScreen />;
  if (phase === "r1") return <RoundDisplay storageKey="r1" playerLabel={`PLAYER 1 (${myTeam.player1})`} targetImage={targetImage} roundLabel="ROUND 1: INITIAL CREATION" onComplete={(img, link) => { setR1Img(img); updateTeamStatus({ round: 1, r1Link: link }); setPhase("interval1"); }} isPaused={isPaused} timeLeft={timeLeft} isRoundEnded={status === 'round1_ended'} />;
  if (phase === "interval1") return <IntervalScreen title="VERBAL TRANSFER" message={`PLAYER 1 (${myTeam.player1}), describe the target image to PLAYER 2 (${myTeam.player2}) verbally. Do not show them the screen!`} timeLeft={timeLeft} />;
  if (phase === "r2") return <RoundDisplay storageKey="r2" playerLabel={`PLAYER 2 (${myTeam.player2})`} targetImage={null} roundLabel="ROUND 2: BLIND RECREATION" onComplete={(img, link) => { setR2Img(img); updateTeamStatus({ round: 2, r2Link: link }); setPhase("wait_for_r3"); }} isPaused={isPaused} timeLeft={timeLeft} isRoundEnded={status === 'round2_ended'} />;
  if (phase === "wait_for_r3") return <IntervalScreen title="HOLD POSITION" message="AWAITING ADMIN PROTOCOL FOR ROUND 3" timeLeft={timeLeft} />;
  if (phase === "r3") return <RoundDisplay storageKey="r3" playerLabel={`PLAYER 1 (${myTeam.player1})`} targetImage={r2Img} roundLabel="ROUND 3: REFINEMENT" onComplete={(img, link) => { setR3Img(img); updateTeamStatus({ r3Link: link }); setPhase("select"); }} isPaused={isPaused} timeLeft={timeLeft} isRoundEnded={status === 'round3_ended'} />;
  if (phase === "select") return <SelectionScreen imgR2={r2Img} imgR3={r3Img} onSelect={async (img) => { 
    setFinalImg(img); 
    setPhase("judgment"); 
    try {
      const res = await fetch("https://mayavyuh.onrender.com/api/similarity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_url: targetImage, submitted_url: img })
      });
      const data = await res.json();
      const s = data.similarity_score || 0;
      setScore(s);
      updateTeamStatus({ round: 3, score: s, finalImage: img });
    } catch(e) {
      console.error(e);
      setScore(0);
      updateTeamStatus({ round: 3, score: 0, finalImage: img });
    }
  }} />;
  if (phase === "judgment") return <JudgmentScreen originalImg={targetImage} finalImg={finalImg} score={score} onFinish={() => setPhase("leaderboard")} />;
  if (phase === "leaderboard") return <LeaderboardRedirect teams={globalTeams} />;

  return null;
};

export default function App() {
  const getView = () => { const h=window.location.hash; if(h==="#admin")return"admin"; return"player"; };
  const [view, setView] = useState(getView);
  useEffect(() => { const h=()=>setView(getView()); window.addEventListener("hashchange",h); return()=>window.removeEventListener("hashchange",h); },[]);

  const [teams, setTeams] = useSyncState("maya_teams", INIT_TEAMS);
  const [eventState, setEventState] = useSyncState("maya_event", INIT_EVENT);

  return (
    <>
      <GlobalStyles/>
      <SceneWrapper>
        {view==="admin"   && <AdminDashboard teams={teams} setTeams={setTeams} eventState={eventState} setEventState={setEventState} />}
        {view==="player"  && <PlayerSection globalTeams={teams} setGlobalTeams={setTeams} eventState={eventState} />}
      </SceneWrapper>
    </>
  );
}
