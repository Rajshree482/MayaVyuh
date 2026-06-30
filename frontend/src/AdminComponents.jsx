import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, Database, MonitorPlay, BarChart3, Zap, Skull, Power, Play, Pause, Square, AlertTriangle, ShieldAlert, Cpu, Clock, Activity, RefreshCw } from "lucide-react";
import { useSyncState, broadcastEvent } from "./useSync.js";
import gdgLogo from "./assets/gdg-logo.png";
import bg1 from "./assets/bg-1.jpg";
import bg2 from "./assets/bg-2.jpg";
import bg3 from "./assets/bg-3.jpg";
import bg4 from "./assets/bg-4.jpg";
import bg5 from "./assets/bg-5.jpg";

export const BG_IMAGES = [bg1, bg2, bg3, bg4, bg5];
const API = import.meta.env.VITE_API_URL || "https://mayavyuh.onrender.com";

const API_URL = import.meta.env.VITE_API_URL || "https://mayavyuh.onrender.com";

export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@300;400;600&family=Inter:wght@300;400;600&display=swap');
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --bg-dark: #05050A;
      --bg-panel: rgba(10, 13, 20, 0.75);
      --neon-cyan: #00f3ff;
      --neon-gold: #D4AF37;
      --neon-red: #ff2a2a;
      --neon-green: #00ff88;
      --glass-border: rgba(212, 175, 55, 0.4);
      --glass-bg: rgba(15, 10, 25, 0.5);
      --text-main: #F3E5AB;
      --text-dim: #a99d86;
      --royal-purple: #4a0e4e;
    }

    body, html {
      background: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Space Grotesk', sans-serif;
      overflow-x: hidden;
      min-height: 100vh;
    }

    #root { width: 100%; min-height: 100vh; }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: rgba(0,0,0,0.8); }
    ::-webkit-scrollbar-thumb { background: var(--neon-gold); border-radius: 3px; }

    /* Immersive animated background */
    .immersive-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
    .bg-layer { position: absolute; inset: -5%; background-size: cover; background-position: center; opacity: 0; transition: opacity 3s ease-in-out; filter: brightness(0.3) contrast(1.3) sepia(0.5) hue-rotate(-20deg); }
    .bg-layer.active { opacity: 1; }
    .bg-overlay { position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 0%, #05050A 100%), linear-gradient(180deg, rgba(5,5,10,0.8) 0%, rgba(5,5,10,0.4) 50%, #05050A 100%); backdrop-filter: blur(8px); }

    /* Advanced Glassmorphism */
    .glass-panel {
      background: rgba(10, 10, 15, 0.6);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(212, 175, 55, 0.3);
      padding: 32px;
      position: relative;
      /* Cut corners (Hexagon-like) */
      clip-path: polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px);
      box-shadow: inset 0 0 20px rgba(212, 175, 55, 0.05);
      transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    
    .glass-panel::before {
      content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 2px;
      background: linear-gradient(90deg, transparent, var(--neon-gold), var(--neon-cyan), transparent);
      animation: sweep-light 8s infinite linear;
    }

    .glass-panel:hover {
      background: rgba(15, 15, 20, 0.8);
      border-color: rgba(212, 175, 55, 0.8);
      box-shadow: inset 0 0 30px rgba(212, 175, 55, 0.1), 0 10px 40px rgba(0,0,0,0.9);
      transform: translateY(-2px);
    }

    /* Typography */
    .title-primary {
      font-family: 'Cinzel', serif;
      font-size: clamp(32px, 6vw, 56px);
      font-weight: 900;
      color: var(--neon-gold);
      text-shadow: 0 0 15px rgba(212, 175, 55, 0.4), 0 0 30px rgba(212, 175, 55, 0.2);
      letter-spacing: 6px;
      text-transform: uppercase;
    }

    .title-secondary {
      font-family: 'Cinzel', serif;
      font-size: 20px;
      color: var(--neon-cyan);
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(0, 243, 255, 0.3);
      padding-bottom: 12px;
      text-shadow: 0 0 10px rgba(0, 243, 255, 0.3);
    }

    /* Buttons */
    .btn, .btn-imperial {
      background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(10, 10, 15, 0.8) 100%);
      border: 1px solid var(--neon-gold);
      color: var(--neon-gold);
      padding: 16px 32px;
      font-family: 'Orbitron', sans-serif;
      font-size: 14px;
      letter-spacing: 4px;
      text-transform: uppercase;
      cursor: pointer;
      clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      box-shadow: 0 0 10px rgba(212,175,55,0.1);
    }
    .btn::after, .btn-imperial::after {
      content: ''; position: absolute; inset: 0; background: rgba(212, 175, 55, 0.2); opacity: 0; transition: opacity 0.3s;
    }
    .btn:hover::after, .btn-imperial:hover::after { opacity: 1; }
    .btn:hover:not(:disabled), .btn-imperial:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(212, 175, 55, 0.4);
      transform: translateY(-2px);
      color: #fff;
    }
    .btn-danger, .btn-imperial-danger {
      border: 1px solid var(--neon-red); color: var(--neon-red);
      background: linear-gradient(135deg, rgba(255, 42, 42, 0.1) 0%, rgba(10, 10, 15, 0.8) 100%);
      padding: 16px 32px;
      font-family: 'Orbitron', sans-serif;
      font-size: 14px;
      letter-spacing: 4px;
      text-transform: uppercase;
      cursor: pointer;
      clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
      transition: all 0.3s ease;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .btn-danger:hover:not(:disabled), .btn-imperial-danger:hover:not(:disabled) { box-shadow: 0 0 20px rgba(255, 42, 42, 0.4); color: #fff; transform: translateY(-2px); }
    .btn:disabled, .btn-imperial:disabled, .btn-imperial-danger:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Inputs */
    .input-field {
      width: 100%;
      background: rgba(0, 0, 0, 0.6);
      border: none;
      border-bottom: 2px solid rgba(212, 175, 55, 0.4);
      color: #fff;
      padding: 16px 24px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      letter-spacing: 2px;
    }
    .input-field:focus { border-bottom-color: var(--neon-cyan); background: rgba(0,0,0,0.8); }

    /* Animations */
    @keyframes sweep-light {
      0% { transform: translateX(-100%) skewX(-15deg); }
      100% { transform: translateX(200%) skewX(-15deg); }
    }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
    @keyframes pulse-glow { 0%, 100% { filter: drop-shadow(0 0 15px rgba(212,175,55,0.4)); } 50% { filter: drop-shadow(0 0 30px rgba(212,175,55,0.8)); } }
    @keyframes spin-slow { 100% { transform: rotate(360deg); } }
    @keyframes spin-reverse { 100% { transform: rotate(-360deg); } }
    @keyframes cinematic-enter { 0% { opacity: 0; transform: translateY(40px) scale(0.95); filter: blur(10px); } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }

    /* Specific components */
    .cinematic-card {
      transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.6s ease;
      background: linear-gradient(135deg, rgba(15,10,25,0.9), rgba(5,2,10,0.95));
      border: 1px solid rgba(212, 175, 55, 0.3);
      position: relative;
    }
    .cinematic-card:hover {
      transform: scale(1.03) translateY(-10px);
      box-shadow: 0 30px 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(212, 175, 55, 0.1);
      border-color: var(--neon-gold);
    }
    
    .status-badge { padding: 6px 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px); }
    .status-active { background: rgba(0, 255, 136, 0.15); color: var(--neon-green); border-left: 2px solid var(--neon-green); }
    .status-banned { background: rgba(255, 42, 42, 0.15); color: var(--neon-red); border-left: 2px solid var(--neon-red); }

    /* Chat/Terminal Interface Layout */
    .chat-layout { display: flex; height: 100vh; overflow: hidden; position: relative; z-index: 1; }
    .chat-sidebar {
      width: 400px;
      background: rgba(5, 5, 10, 0.9);
      border-right: 1px solid rgba(212, 175, 55, 0.3);
      padding: 32px;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(20px);
      box-shadow: 10px 0 40px rgba(0,0,0,0.8);
      z-index: 10;
    }
    .chat-main { flex: 1; display: flex; flex-direction: column; position: relative; padding: 40px; overflow-y: auto; align-items: center; justify-content: center; }

    /* Legacy classes mapped to new aesthetic */
    .imperial-bg { position: relative; z-index: 1; }
    .imperial-glass { 
      background: rgba(10, 10, 15, 0.6); 
      backdrop-filter: blur(24px); 
      border: 1px solid rgba(212, 175, 55, 0.3); 
      padding: 32px; 
      position: relative; 
      clip-path: polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px); 
      box-shadow: inset 0 0 20px rgba(212, 175, 55, 0.05); 
    }
    .imperial-panel { 
      clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px); 
      background: rgba(5,5,10,0.85); 
      backdrop-filter: blur(30px); 
      border: 1px solid rgba(212,175,55,0.4); 
      box-shadow: 0 20px 50px rgba(0,0,0,0.9); 
    }
    .imperial-gold-text { color: #D4AF37; text-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }
    .imperial-red-text { color: #ff2a2a; text-shadow: 0 0 15px rgba(255, 42, 42, 0.4); }
    .core-pulse { animation: pulse-glow 4s infinite alternate; }
    .core-pulseDanger { animation: pulse-glow 2s infinite alternate; filter: drop-shadow(0 0 30px rgba(255,42,42,0.8)); }

    /* Overwrite fusion classes */
    .fusion-bg { position: relative; z-index: 1; }
    .fusion-monolith { 
      background: rgba(10, 10, 15, 0.6); 
      backdrop-filter: blur(24px); 
      border: 1px solid rgba(212, 175, 55, 0.3); 
      padding: 32px; 
      position: relative; 
      clip-path: polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px); 
    }
    .fusion-gold-heading { 
      font-family: 'Cinzel', serif; 
      font-size: clamp(32px, 6vw, 56px); 
      font-weight: 900; 
      color: var(--neon-gold); 
      text-shadow: 0 0 15px rgba(212, 175, 55, 0.4); 
      letter-spacing: 6px; 
      text-transform: uppercase; 
    }
    .fusion-tech-text { font-family: 'Space Grotesk', sans-serif; color: #C5C6C7; letter-spacing: 3px; font-size: 14px; text-transform: uppercase; }
    .fusion-input-container { position: relative; margin-bottom: 24px; }
    .fusion-input { 
      width: 100%; 
      background: rgba(0, 0, 0, 0.6); 
      border: none; 
      border-bottom: 2px solid rgba(212, 175, 55, 0.4); 
      color: #fff; 
      padding: 16px 24px; 
      padding-left: 48px; 
      font-family: 'Space Grotesk', sans-serif; 
      font-size: 16px; 
      outline: none; 
      transition: all 0.3s ease; 
      letter-spacing: 2px; 
      clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); 
    }
    .fusion-input:focus { border-bottom-color: var(--neon-cyan); background: rgba(0,0,0,0.8); }
    .stagger-slide-up { animation: cinematic-enter 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; opacity: 0; }
  `}</style>
)


export const BackgroundWrapper = () => {
  const [activeBg, setActiveBg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveBg(a => (a + 1) % BG_IMAGES.length), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="immersive-bg">
      {BG_IMAGES.map((src, i) => (
        <div key={i} className={`bg-layer ${i === activeBg ? "active" : ""}`} style={{ backgroundImage: `url(${src})` }} />
      ))}
      <div className="bg-overlay" />
    </div>
  );
};

export const SceneWrapper = ({ children }) => (
  <>
    <BackgroundWrapper />
    {children}
  </>
);



const AdminLogin = ({ onLogin }) => {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const handleLogin = (e) => {
    e.preventDefault();
    if (pwd === "admin" || pwd === "gdgproject3" || pwd === "mayavyuh") onLogin();
    else {
      setErr("ACCESS DENIED");
      setPwd("");
    }
  };

  return (
    <div className="imperial-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      {}
      <div style={{ position: "absolute", width: "150vw", height: "150vh", background: "radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 50%)", animation: "pulse 4s infinite alternate" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, border: "1px dashed rgba(212, 175, 55, 0.2)", borderRadius: "50%", animation: "spin-slow 20s linear infinite" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 800, height: 800, border: "1px solid rgba(212, 175, 55, 0.05)", borderRadius: "50%", animation: "spin-reverse 30s linear infinite" }} />

      <motion.form 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 0.8, ease: "easeOut" }}
        onSubmit={handleLogin} 
        className="imperial-glass imperial-panel" 
        style={{ width: 450, padding: 64, textAlign: "center", position: "relative", zIndex: 10, border: "1px solid rgba(212, 175, 55, 0.4)", boxShadow: "0 0 50px rgba(0,0,0,0.8), inset 0 0 30px rgba(212, 175, 55, 0.1)" }}
      >
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "var(--bg-dark)", padding: "4px 24px", color: "#D4AF37", letterSpacing: 4, fontSize: 10, border: "1px solid rgba(212, 175, 55, 0.4)", borderRadius: 20 }}>IMPERIAL DATACRON</div>
        
        <ShieldAlert size={64} color="#D4AF37" style={{ margin: "0 auto", marginBottom: 32, filter: "drop-shadow(0 0 15px rgba(212,175,55,0.4))" }} />
        
        <div className="imperial-gold-text" style={{ fontFamily: "'Cinzel', serif", fontSize: 28, marginBottom: 8, letterSpacing: 6 }}>RESTRICTED AREA</div>
        <div style={{ color: "rgba(212, 175, 55, 0.6)", fontSize: 12, letterSpacing: 4, marginBottom: 48 }}>SECURITY CLEARANCE REQUIRED</div>
        
        <div style={{ position: "relative", marginBottom: 32 }}>
          <input 
            type="password" 
            placeholder="ENTER OVERRIDE CODE" 
            value={pwd} 
            onChange={e => { setPwd(e.target.value); setErr(""); }} 
            style={{ width: "100%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(212, 175, 55, 0.3)", padding: "16px 24px", color: "#D4AF37", fontSize: 16, outline: "none", textAlign: "center", letterSpacing: 8, fontFamily: "'Orbitron', sans-serif", borderRadius: 4, transition: "all 0.3s" }} 
            autoFocus 
            onFocus={(e) => e.target.style.borderColor = "#D4AF37"}
            onBlur={(e) => e.target.style.borderColor = "rgba(212, 175, 55, 0.3)"}
          />
          <div style={{ position: "absolute", bottom: -1, left: "10%", width: "80%", height: 1, background: "linear-gradient(90deg, transparent, #D4AF37, transparent)" }} />
        </div>

        <AnimatePresence>
          {err && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="imperial-red-text" style={{ marginBottom: 24, fontSize: 12, letterSpacing: 4, textShadow: "0 0 10px rgba(255,42,42,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <AlertTriangle size={16} style={{ marginRight: 8 }} />
              {err}
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" className="btn-imperial" style={{ width: "100%", padding: 20, letterSpacing: 6, fontSize: 14, marginTop: 16, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
          AUTHENTICATE <Power size={16} />
        </button>
      </motion.form>
    </div>
  );
};

const MayaNexusNav = ({ active, setActive }) => {
  const [isHovered, setIsHovered] = useState(false);
  const sections = [
    { id: "CORE", icon: <Cpu size={24} />, label: "DATACRON CORE" },
    { id: "TLM", icon: <Activity size={24} />, label: "TELEMETRY" },
    { id: "VAULT", icon: <Database size={24} />, label: "IMAGE VAULT" },
    { id: "OVR", icon: <AlertTriangle size={24} />, label: "OVERRIDES" }
  ];

  return (
    <motion.div 
      style={{ position: "fixed", bottom: 48, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", gap: 16, padding: 16, background: "rgba(5, 2, 10, 0.9)", border: "1px solid rgba(212, 175, 55, 0.4)", borderRadius: 50, boxShadow: "0 0 50px rgba(0,0,0,0.9), inset 0 0 20px rgba(212, 175, 55, 0.1)", backdropFilter: "blur(20px)" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      animate={{ width: isHovered ? "auto" : "auto" }}
    >
      {sections.map(s => {
        const isActive = active === s.id;
        return (
          <motion.div
            key={s.id}
            onClick={() => setActive(s.id)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 24px", cursor: "pointer", borderRadius: 30, background: isActive ? "rgba(212, 175, 55, 0.15)" : "transparent", border: isActive ? "1px solid rgba(212, 175, 55, 0.8)" : "1px solid transparent", transition: "all 0.4s" }}
            whileHover={{ scale: 1.05, background: "rgba(212, 175, 55, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <div style={{ color: isActive ? "#D4AF37" : "rgba(212, 175, 55, 0.5)", display: "flex", alignItems: "center", filter: isActive ? "drop-shadow(0 0 10px rgba(212, 175, 55, 0.8))" : "none" }}>
              {s.icon}
            </div>
            {isHovered && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                style={{ fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: 2, color: isActive ? "#D4AF37" : "rgba(212, 175, 55, 0.6)", whiteSpace: "nowrap" }}
              >
                {s.label}
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
};

const ImageVaultSection = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchImages(); }, []);
  const fetchImages = async () => {
    try {
      const res = await fetch(`${API}/api/admin/images`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setImages(data);
      } else {
        console.error("Backend error:", data);
        setImages([]);
      }
    } catch(err) { console.error(err); setImages([]); }
  };

  const handleUpload = async (e) => {
    if (loading) return; // Prevent double trigger
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("images", files[i]);
    }
    
    try {
      await fetch(`${API}/api/admin/upload-image`, { method: "POST", body: formData });
      fetchImages();
    } catch (err) { console.error(err); } 
    finally { 
      setLoading(false); 
      e.target.value = null; // Clear input to prevent stuck state
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/api/admin/images/${id}`, { method: 'DELETE' });
      setImages(images.filter(img => img._id !== id));
    } catch(err) { console.error(err); }
  };

  return (
    <div className="imperial-glass imperial-panel" style={{ flex: 1, padding: 48, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 32, letterSpacing: 4 }} className="imperial-gold-text">IMPERIAL IMAGE VAULT</div>
        <div style={{ display: "flex", gap: 16 }}>
          <label className="btn-imperial" style={{ padding: "12px 32px", fontSize: 12, letterSpacing: 2 }}>
            {loading ? "UPLOADING..." : "UPLOAD ARTIFACT"}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleUpload} disabled={loading} />
          </label>
        </div>
      </div>
      
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 32, paddingRight: 16 }}>
        {images.map((img, i) => (
          <div key={img._id} style={{ position: "relative", height: 250, border: "1px solid rgba(212, 175, 55, 0.2)", borderRadius: 8, overflow: "hidden", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.9)", padding: "4px 12px", border: "1px solid rgba(212, 175, 55, 0.4)", color: "#D4AF37", fontSize: 10, letterSpacing: 2, zIndex: 10 }}>
              TEAM {img.teamNumber ? img.teamNumber : String(i + 1).padStart(2, '0')}
            </div>
            <button onClick={() => handleDelete(img._id)} className="btn-imperial-danger" style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 16, zIndex: 10 }}>×</button>
            <img src={img.url} alt={`Artifact ${i}`} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8, transition: "opacity 0.3s" }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.8} />
          </div>
        ))}
        {images.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 100, border: "1px dashed rgba(212, 175, 55, 0.2)", color: "rgba(212, 175, 55, 0.5)", fontSize: 14, letterSpacing: 4 }}>
            THE VAULT IS EMPTY
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminDashboard = ({ teams, setTeams, eventState, setEventState }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState("CORE");
  
  const [session, setSession] = useState(null);
  const [durations, setDurations] = useState({ 1: 1200, 2: 1200, 3: 1500 });
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // Anti-cheat violation data fetched from backend
  const [violations, setViolations] = useState({});
  const fetchViolations = async () => {
    try {
      const res = await fetch(`${API}/api/anticheat/violations`);
      const data = await res.json();
      if (data.success) setViolations(data.violations || {});
    } catch (err) { /* silent */ }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch(`${API}/api/game/status`);
      const data = await res.json();
      if (data.session) setSession(data.session);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (isAuthenticated) { fetchSession(); fetchViolations(); }
    const interval = setInterval(() => {
      if (isAuthenticated) { fetchSession(); fetchViolations(); }
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!session?.roundEndTime) { setTimeLeft(0); return; }
    const tick = () => {
      if (session.isPaused && session.timeRemainingAtPause != null) {
        setTimeLeft(Math.floor(session.timeRemainingAtPause / 1000));
      } else {
        setTimeLeft(Math.max(0, Math.floor((new Date(session.roundEndTime) - Date.now()) / 1000)));
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [session?.roundEndTime, session?.isPaused, session?.timeRemainingAtPause]);

  const gameAction = async (action, round) => {
    setLoading(true);
    try {
      const duration = round ? durations[round] : undefined;
      await fetch(`${API}/api/game/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, round, duration })
      });
      fetchSession();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleBan = (id) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, status: t.status === "banned" ? "active" : "banned" } : t));
  };

  const globalReset = () => {
    if (!window.confirm("WARNING: This will obliterate all records and reset the system. Proceed?")) return;
    setTeams([]);
    gameAction('reset');
    setEventState({ started: false, phase: "lobby" });
    broadcastEvent("GLOBAL_RESET");
  };

  const seedDatabase = () => alert("IMPERIAL PROTOCOL: SEED_DB triggered!");

  const sortedTeams = [...teams];
  const status = session?.status || 'waiting';
  const fmtTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const isLive = status.includes('active');
  const isDanger = session?.isPaused;
  const itemVars = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 80 } } };

  if (!isAuthenticated) return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;

  const renderSection = () => {
    switch (activeSection) {
      case "CORE":
        return (
          <motion.div key="core" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, padding: "48px 64px", minHeight: 750 }}>
            <motion.div variants={itemVars} style={{ display: "flex", flexDirection: "column", gap: 32, minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(212, 175, 55, 0.2)", paddingBottom: 16 }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 24, letterSpacing: 4 }} className="imperial-gold-text">DATACRON MATRIX</span>
              </div>
              <div className="custom-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", paddingRight: 8, flex: 1 }}>
                {[1, 2, 3].map(r => {
                  const isActive = status === `round${r}_active`;
                  const isEnded = status === `round${r}_ended`;
                  const canStart = true; // Bypassed: (isIdle && r === 1) || status === `round${r-1}_ended` || status === `round${r}_ended`;
                  return (
                    <div key={r} className="imperial-glass imperial-panel" style={{ padding: 32, transition: "all 0.5s", border: isActive ? "1px solid rgba(212, 175, 55, 0.8)" : "1px solid rgba(212, 175, 55, 0.15)", boxShadow: isActive ? "0 0 40px rgba(212, 175, 55, 0.15), inset 0 0 20px rgba(212, 175, 55, 0.05)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "rgba(212,175,55,0.6)", marginBottom: 8, letterSpacing: 2 }}>[ ASCENSION TIER {r} ]</div>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 32, letterSpacing: 4 }} className={isActive ? "imperial-gold-text" : "text-gray-500"}>PHASE 0{r}</div>
                        </div>
                        <div style={{ padding: "6px 16px", border: isActive ? "1px solid #D4AF37" : "1px dashed rgba(255,255,255,0.2)", color: isActive ? "#D4AF37" : "#718096", fontSize: 10, letterSpacing: 3, display: "flex", alignItems: "center", gap: 8, background: isActive ? "rgba(212, 175, 55, 0.1)" : "transparent" }}>
                          {isActive && <span style={{ width: 6, height: 6, background: "#D4AF37", animation: "pulse 1s infinite" }} />}
                          {isActive ? 'ASCENDING' : isEnded ? 'SEALED' : 'LOCKED'}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.6)", padding: "12px 16px", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
                          <input type="number" value={durations[r]} onChange={e => setDurations({...durations, [r]: parseInt(e.target.value)||0})} disabled={isActive} style={{ background: "transparent", border: "none", color: "#D4AF37", width: 60, textAlign: "center", fontSize: 16, outline: "none" }} />
                          <span style={{ fontSize: 10, color: "rgba(212,175,55,0.6)", letterSpacing: 2 }}>SEC</span>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                          {isActive && !session?.isPaused && (
                            <>
                              <button onClick={() => gameAction('pause_round', r)} className="btn-imperial" style={{ padding: 16 }}>PAUSE</button>
                              <button onClick={() => gameAction('end_round', r)} className="btn-imperial" style={{ padding: "16px 32px", fontSize: 12, letterSpacing: 2 }}>HALT</button>
                            </>
                          )}
                          {isActive && session?.isPaused && (
                            <button onClick={() => gameAction('resume_round', r)} className="btn-imperial" style={{ padding: "16px 32px", fontSize: 12, letterSpacing: 2, borderColor: "#D4AF37" }}>RESUME</button>
                          )}
                          {!isActive && canStart && (
                            <button onClick={() => gameAction('start_round', r)} className="btn-imperial" style={{ padding: "16px 32px", fontSize: 12, letterSpacing: 2 }}>INITIATE</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={itemVars} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", minHeight: 0 }}>
              <div className={isDanger ? "core-pulseDanger" : isLive ? "core-pulse" : ""} style={{ position: "relative", width: "100%", maxWidth: 600, aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", width: "100%", height: "100%", border: "2px solid rgba(212, 175, 55, 0.1)", borderRadius: "50%" }} />
                <div style={{ position: "absolute", width: "95%", height: "95%", borderTop: isLive ? "2px solid #D4AF37" : "2px solid rgba(255,255,255,0.1)", borderRadius: "50%" }} className="animate-spin-slow" />
                <div style={{ position: "absolute", width: "88%", height: "88%", borderBottom: isDanger ? "4px solid #ff2a2a" : isLive ? "4px solid #D4AF37" : "4px dashed rgba(255,255,255,0.1)", borderRadius: "50%", opacity: 0.5 }} className="animate-spin-reverse" />
                <div style={{ position: "absolute", width: "80%", height: "80%", background: "radial-gradient(circle, rgba(10,5,20,0.9) 0%, rgba(3,3,5,0.9) 100%)", borderRadius: "50%", border: "1px solid rgba(212, 175, 55, 0.3)", boxShadow: isLive ? "inset 0 0 50px rgba(212,175,55,0.1)" : "none" }} />
                
                <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  {isLive ? (
                    <>
                      <div style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(12px, 1.2vw, 16px)", letterSpacing: 8, color: isDanger ? "#ff2a2a" : "#D4AF37", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 8, height: 8, background: isDanger ? "#ff2a2a" : "#D4AF37", transform: "rotate(45deg)" }} />
                        {isDanger ? "TEMPORAL HALT" : "EXECUTION PROTOCOL"}
                        <span style={{ width: 8, height: 8, background: isDanger ? "#ff2a2a" : "#D4AF37", transform: "rotate(45deg)" }} />
                      </div>
                      <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(80px, 8vw, 120px)", fontWeight: "bold", lineHeight: 1, letterSpacing: -2, color: "#fff", textShadow: isDanger ? "0 0 40px rgba(255,42,42,0.6)" : "0 0 40px rgba(212,175,55,0.6)" }}>
                        {fmtTime(timeLeft)}
                      </div>
                      <div style={{ marginTop: 32, padding: "8px 24px", border: "1px solid rgba(212,175,55,0.2)", color: "rgba(212,175,55,0.8)", fontSize: 12, letterSpacing: 4, background: "rgba(0,0,0,0.5)" }}>
                        {status.toUpperCase().replace('_', ' ')}
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={64} color="rgba(212,175,55,0.3)" style={{ marginBottom: 32 }} />
                      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 24, letterSpacing: 8, color: "rgba(212,175,55,0.5)" }}>AWAITING PROTOCOL</div>
                      <div style={{ fontSize: 12, letterSpacing: 4, color: "#718096", marginTop: 16 }}>SYSTEM IN STASIS</div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        );

      case "TLM":
        return (
          <motion.div key="tlm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 32, padding: "48px 64px", minHeight: 750 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(212, 175, 55, 0.2)", paddingBottom: 16 }}>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 24, letterSpacing: 4 }} className="imperial-gold-text">TELEMETRY & ROSTER</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, flex: 1 }}>
              <div className="imperial-glass imperial-panel custom-scrollbar" style={{ padding: 32, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 14, letterSpacing: 4, color: "#D4AF37", marginBottom: 16, borderBottom: "1px dashed rgba(212,175,55,0.2)", paddingBottom: 16 }}>LIVE SIGNALS</div>
                {sortedTeams.map((t, i) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: i === 0 ? "rgba(212,175,55,0.1)" : "rgba(0,0,0,0.5)", border: i === 0 ? "1px solid rgba(212,175,55,0.5)" : "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
                    {i === 0 && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#D4AF37", boxShadow: "0 0 10px #D4AF37" }} />}
                    <div style={{ width: 24, textAlign: "center", fontFamily: "'Cinzel', serif", fontSize: 16, color: i === 0 ? "#D4AF37" : "rgba(255,255,255,0.5)" }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: i === 0 ? "#D4AF37" : "#fff", letterSpacing: 2 }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 4 }}>P1:{t.player1} | P2:{t.player2}</div>
                    </div>
                    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, color: i === 0 ? "#D4AF37" : "rgba(255,255,255,0.5)" }}>R{t.round || 0}</div>
                  </div>
                ))}
                {sortedTeams.length === 0 && <div style={{ color: "#718096", textAlign: "center", padding: 40, letterSpacing: 2, fontSize: 12 }}>NO SIGNALS DETECTED</div>}
              </div>
              
              <div className="imperial-glass imperial-panel custom-scrollbar" style={{ padding: 32, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 14, letterSpacing: 4, color: "#D4AF37", marginBottom: 16, borderBottom: "1px dashed rgba(212,175,55,0.2)", paddingBottom: 16 }}>THE ROSTER</div>
                {teams.map((t) => (
                  <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24, background: "rgba(0,0,0,0.5)", border: t.status === "banned" ? "1px solid rgba(255,42,42,0.3)" : "1px solid rgba(212,175,55,0.2)", borderLeft: t.status === "banned" ? "4px solid #ff2a2a" : "4px solid #D4AF37" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 16, color: "#fff", letterSpacing: 2, fontFamily: "'Cinzel', serif" }}>{t.name}</div>
                      <span style={{ fontSize: 10, letterSpacing: 2, color: t.status === "banned" ? "#ff2a2a" : "#D4AF37", padding: "4px 12px", background: t.status === "banned" ? "rgba(255,42,42,0.1)" : "rgba(212,175,55,0.1)", border: t.status === "banned" ? "1px solid rgba(255,42,42,0.3)" : "1px solid rgba(212,175,55,0.3)" }}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>
                      P1: {t.player1} <br/> P2: {t.player2}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                      {t.r1Link && <a href={t.r1Link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--neon-cyan)", textDecoration: "none", letterSpacing: 1 }}>➔ VERIFY R1 CHAT SNAPSHOT</a>}
                      {t.r2Link && <a href={t.r2Link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--neon-cyan)", textDecoration: "none", letterSpacing: 1 }}>➔ VERIFY R2 CHAT SNAPSHOT</a>}
                      {t.r3Link && <a href={t.r3Link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--neon-cyan)", textDecoration: "none", letterSpacing: 1 }}>➔ VERIFY R3 CHAT SNAPSHOT</a>}
                    </div>
                    <button className={t.status === "banned" ? "btn-imperial" : "btn-imperial-danger"} style={{ padding: "12px", fontSize: 10, letterSpacing: 2, marginTop: 8 }} onClick={() => toggleBan(t.id)}>
                      {t.status === "banned" ? "RESTORE TO GLORY" : "BANISH FROM DATACRON"}
                    </button>
                  </div>
                ))}
                {teams.length === 0 && <div style={{ color: "#718096", textAlign: "center", padding: 40, letterSpacing: 2, fontSize: 12 }}>ROSTER EMPTY</div>}
              </div>
            </div>

            {/* ── ANTI-CHEAT VIOLATION PANEL ── */}
            {Object.keys(violations).length > 0 && (
              <div className="imperial-glass imperial-panel custom-scrollbar" style={{ padding: 32, marginTop: 8 }}>
                <div style={{ fontSize: 14, letterSpacing: 4, color: "#ff2a2a", marginBottom: 16, borderBottom: "1px dashed rgba(255,42,42,0.3)", paddingBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <ShieldAlert size={16} color="#ff2a2a" />
                  ANTI-CHEAT LOG
                  <span style={{ fontSize: 10, color: "rgba(255,42,42,0.6)", letterSpacing: 2 }}>— AUTO-REFRESHES EVERY 5s</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {Object.entries(violations).map(([teamId, data]) => {
                    const matchedTeam = teams.find(t => t.id === teamId);
                    const teamName = matchedTeam?.name || `TEAM ${teamId.slice(-6).toUpperCase()}`;
                    const isHighRisk = data.count >= 5;
                    return (
                      <div key={teamId} style={{ padding: 16, background: isHighRisk ? "rgba(255,42,42,0.07)" : "rgba(0,0,0,0.5)", border: isHighRisk ? "1px solid rgba(255,42,42,0.5)" : "1px solid rgba(255,42,42,0.2)", borderLeft: `4px solid ${isHighRisk ? "#ff2a2a" : "rgba(255,42,42,0.4)"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 13, color: isHighRisk ? "#ff2a2a" : "#fff", letterSpacing: 1 }}>{teamName}</div>
                          <span style={{ fontSize: 20, fontFamily: "'Orbitron', sans-serif", color: isHighRisk ? "#ff2a2a" : "rgba(255,120,120,0.8)", fontWeight: "bold" }}>{data.count}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {[...new Set(data.events.map(e => e.type))].map(type => (
                            <span key={type} style={{ fontSize: 9, padding: "2px 8px", background: "rgba(255,42,42,0.1)", border: "1px solid rgba(255,42,42,0.3)", color: "rgba(255,150,150,0.9)", letterSpacing: 1 }}>
                              {type.replace(/_/g, " ").toUpperCase()}
                            </span>
                          ))}
                        </div>
                        {data.events.length > 0 && (
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 8, letterSpacing: 1 }}>
                            LAST: {new Date(data.events[data.events.length - 1].ts).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        );

      case "VAULT":
        return (
          <motion.div key="vault" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 64px", minHeight: 750 }}>
             <ImageVaultSection />
          </motion.div>
        );

      case "OVR":
        return (
          <motion.div key="ovr" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 64px", minHeight: 750, alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <ShieldAlert size={80} color="#ff2a2a" style={{ margin: "0 auto", marginBottom: 32, filter: "drop-shadow(0 0 20px rgba(255,42,42,0.4))" }} />
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 48, letterSpacing: 8, color: "#ff2a2a", textShadow: "0 0 20px rgba(255,42,42,0.5)" }}>SYSTEM OVERRIDES</div>
              <div style={{ fontSize: 14, letterSpacing: 8, color: "rgba(255,42,42,0.6)", marginTop: 16 }}>DANGER ZONE • IRREVERSIBLE PROTOCOLS</div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32, width: "100%", maxWidth: 1000 }}>
              <div className="imperial-glass imperial-panel" style={{ padding: 48, textAlign: "center", border: "1px solid rgba(255,42,42,0.3)" }}>
                <Power size={48} color="#ff2a2a" style={{ margin: "0 auto", marginBottom: 24 }} />
                <div style={{ fontSize: 20, color: "#ff2a2a", letterSpacing: 2, marginBottom: 24, fontFamily: "'Cinzel', serif" }}>TERMINATE</div>
                <button onClick={() => gameAction('finish')} className="btn-imperial-danger" style={{ width: "100%", padding: "16px", fontSize: 12, letterSpacing: 4 }}>EXECUTE</button>
              </div>

              <div className="imperial-glass imperial-panel" style={{ padding: 48, textAlign: "center", border: "1px solid rgba(212,175,55,0.3)" }}>
                <RefreshCw size={48} color="#D4AF37" style={{ margin: "0 auto", marginBottom: 24 }} />
                <div style={{ fontSize: 20, color: "#D4AF37", letterSpacing: 2, marginBottom: 24, fontFamily: "'Cinzel', serif" }}>SEED CORE</div>
                <button onClick={seedDatabase} className="btn-imperial" style={{ width: "100%", padding: "16px", fontSize: 12, letterSpacing: 4 }}>EXECUTE</button>
              </div>

              <div className="imperial-glass imperial-panel" style={{ padding: 48, textAlign: "center", border: "1px solid rgba(255,42,42,0.3)" }}>
                <Skull size={48} color="#ff2a2a" style={{ margin: "0 auto", marginBottom: 24 }} />
                <div style={{ fontSize: 20, color: "#ff2a2a", letterSpacing: 2, marginBottom: 24, fontFamily: "'Cinzel', serif" }}>PURGE ALL</div>
                <button onClick={globalReset} className="btn-imperial-danger" style={{ width: "100%", padding: "16px", fontSize: 12, letterSpacing: 4 }}>EXECUTE</button>
              </div>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="imperial-bg" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", color: "#e2e8f0", paddingBottom: 120 }}>
      <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1 }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 64px", borderBottom: "1px solid rgba(212, 175, 55, 0.1)", background: "rgba(0,0,0,0.5)", zIndex: 10 }}>
        <button onClick={() => window.location.reload()} className="btn-imperial-danger" style={{ padding: "8px 24px", fontSize: 10, letterSpacing: 3, display: "flex", alignItems: "center", gap: 8 }}>
          <Power size={12} /> RELINQUISH THRONE
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: 24, fontWeight: "bold", letterSpacing: 6 }} className="imperial-gold-text">IMPERIAL COMMAND</span>
            <span style={{ fontSize: 10, letterSpacing: 8, color: "rgba(212, 175, 55, 0.5)", marginTop: 4 }}>MAYAVYUH APEX PROTOCOL</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 24px", background: "rgba(212, 175, 55, 0.05)", border: "1px solid rgba(212, 175, 55, 0.2)", borderRadius: 50 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: isLive ? "#D4AF37" : "#4A0E17", boxShadow: isLive ? "0 0 10px #D4AF37" : "0 0 10px #4A0E17", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 10, letterSpacing: 3, color: isLive ? "#D4AF37" : "#4A0E17" }}>{isLive ? "SYSTEM ASCENDANT" : "SYSTEM DORMANT"}</span>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {renderSection()}
      </AnimatePresence>

      <MayaNexusNav active={activeSection} setActive={setActiveSection} />
    </div>
  );
};