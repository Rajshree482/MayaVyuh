import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, User, Users, Crosshair } from "lucide-react";
import { useSyncState, broadcastEvent, useEventListener } from "./useSync.js";
import { AdminDashboard, SceneWrapper, GlobalStyles, BG_IMAGES } from "./AdminComponents.jsx";
import gdgLogo from "./assets/gdg-logo.png";
const API = import.meta.env.VITE_API_URL || "https://mayavyuh.onrender.com";
const INIT_TEAMS = [];
const INIT_EVENT = { started: false, phase: "lobby" };

// ============================================================
// ANTI-CHEAT HOOK
// Runs only on the player view. Silently logs violations and
// sends them to the backend. Never alerts or disrupts gameplay.
// ============================================================
function useAntiCheat({ isPlayer, teamId, onDisqualify, isPaused, forceCloseWindow }) {
  const violationCountRef = useRef(0);
  const geminiWindowRef = useRef(null);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    if (isPaused || forceCloseWindow) {
      const tryClose = () => {
        window.focus();
        if (geminiWindowRef.current && !geminiWindowRef.current.closed) {
          try { geminiWindowRef.current.close(); } catch (e) { }
        }
        try {
          const fallbackWin = window.open('', 'GeminiPopup');
          if (fallbackWin && !fallbackWin.closed) fallbackWin.close();
        } catch (e) { }
      };
      tryClose();
      setTimeout(tryClose, 500);
      setTimeout(tryClose, 1500);
    }
  }, [isPaused, forceCloseWindow]);

  // Store a ref to the gemini popup so we can track it
  // We expose a setter so RoundDisplay can register the popup
  const registerGeminiWindow = useCallback((win) => {
    geminiWindowRef.current = win;
  }, []);

  const showBanner = useCallback((msg) => {
    const banner = document.getElementById("ac-violation-banner");
    if (!banner) return;
    banner.textContent = `⚠ SECURITY ALERT: ${msg}`;
    banner.classList.add("ac-show");
    clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      banner.classList.remove("ac-show");
    }, 3000);
  }, []);

  const reportViolation = useCallback((type) => {
    if (!isPlayer) return;
    violationCountRef.current += 1;
    const count = violationCountRef.current;

    // Silent report to backend — fire and forget
    fetch(`${API}/api/anticheat/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, type, count, ts: Date.now() }),
    }).catch(() => { }); // intentionally swallow errors — never disrupt gameplay

    // Trigger instant disqualification for critical offenses
    if (type === "tab_switch" || type === "copy_attempt" || type === "screenshot_attempt") {
      if (onDisqualify) onDisqualify(type);
      return; // Stop here, no need to show a banner if they are disqualified
    }

    showBanner(
      type === "devtools"
        ? "DEVTOOLS DETECTED"
        : "UNAUTHORIZED ACTION"
    );
  }, [isPlayer, teamId, showBanner, onDisqualify]);

  useEffect(() => {
    if (!isPlayer) return;

    // ----------------------------------------------------------
    // 1. Tab / window visibility — detect switching away
    // ----------------------------------------------------------
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Only flag if NOT the Gemini popup being interacted with
        // (We can't know for sure, so we log it but don't block)
        reportViolation("tab_switch");
        document.body.classList.add("ac-focus-lost");
      } else {
        document.body.classList.remove("ac-focus-lost");
      }
    };

    // ----------------------------------------------------------
    // 2. Window blur — fires when focus moves to another window/tab
    //    We allow blur to Gemini popup by checking if our own
    //    popup is what caused it (best-effort).
    // ----------------------------------------------------------
    const handleWindowBlur = () => {
      // Short delay so the popup's focus can register first
      setTimeout(() => {
        const geminiWin = geminiWindowRef.current;
        const geminiAlive = geminiWin && !geminiWin.closed;
        // If Gemini popup is open and was just opened, don't flag
        if (!geminiAlive) {
          document.body.classList.add("ac-focus-lost");
        }
      }, 200);
    };

    const handleWindowFocus = () => {
      document.body.classList.remove("ac-focus-lost");
    };

    // ----------------------------------------------------------
    // 3. Keyboard shortcut interception
    //    Ctrl+C / Cmd+C: silently swallowed — no alert, no error
    //    Screenshot keys (PrintScreen): silently swallowed
    //    Ctrl+S, Ctrl+U, Ctrl+P, F12, Ctrl+Shift+I: blocked silently
    // ----------------------------------------------------------
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+C — intercept silently (player sees nothing wrong)
      if (ctrl && e.key === "c") {
        // Clear the clipboard silently so they can't paste the image
        try {
          navigator.clipboard.writeText("").catch(() => { });
        } catch (_) { }
        reportViolation("copy_attempt");
        // DO NOT call e.preventDefault() — requirement says it shouldn't fail
        // Just poison the clipboard content instead
        return;
      }

      // PrintScreen
      if (e.key === "PrintScreen") {
        // Poison clipboard after screenshot key
        try {
          navigator.clipboard.writeText("").catch(() => { });
        } catch (_) { }
        reportViolation("screenshot_attempt");
        e.preventDefault();
        return;
      }

      // Block devtools shortcuts silently
      if (
        e.key === "F12" ||
        (ctrl && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (ctrl && e.key === "U") ||
        (ctrl && e.key === "s") ||
        (ctrl && e.key === "p")
      ) {
        e.preventDefault();
        reportViolation("devtools");
        return;
      }
    };

    // ----------------------------------------------------------
    // 4. Context menu (right-click) — disable silently on images
    // ----------------------------------------------------------
    const handleContextMenu = (e) => {
      if (e.target.tagName === "IMG") {
        e.preventDefault();
      }
    };

    // ----------------------------------------------------------
    // 5. Drag prevention on images
    // ----------------------------------------------------------
    const handleDragStart = (e) => {
      if (e.target.tagName === "IMG") {
        e.preventDefault();
        reportViolation("drag_attempt");
      }
    };

    // ----------------------------------------------------------
    // 6. Paste interception — block pasting images into the page
    // ----------------------------------------------------------
    const handlePaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          reportViolation("paste_image_attempt");
          return;
        }
      }
      // Text paste is allowed (needed for Gemini link input)
    };

    // ----------------------------------------------------------
    // 7. DevTools size detection (heuristic — best effort)
    // ----------------------------------------------------------
    let devToolsCheckInterval = null;
    const checkDevTools = () => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        reportViolation("devtools");
      }
    };
    devToolsCheckInterval = setInterval(checkDevTools, 3000);

    // Attach all listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown, true); // capture phase

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown, true);
      clearInterval(devToolsCheckInterval);
      clearTimeout(bannerTimerRef.current);
      document.body.classList.remove("ac-focus-lost");
    };
  }, [isPlayer, reportViolation]);

  return { registerGeminiWindow };
}

// ============================================================

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

const DisqualifiedScreen = ({ teamName, reason }) => {
  const displayReason =
    reason === "tab_switch" ? "TAB SWITCH DETECTED" :
      reason === "copy_attempt" ? "CLIPBOARD INTERCEPTED" :
        reason === "screenshot_attempt" ? "SCREENSHOT ATTEMPT DETECTED" :
          "UNAUTHORIZED ACTION";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 3, ease: "easeInOut" }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        fontFamily: "'Cinzel', serif",
        textAlign: "center"
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 4, delay: 1, ease: "easeOut" }}
        style={{
          fontSize: "4rem",
          letterSpacing: "8px",
          color: "#8a0303",
          textShadow: "0 0 20px rgba(255, 0, 0, 0.4), 0 0 40px rgba(255, 0, 0, 0.2)",
          marginBottom: "40px",
          textTransform: "uppercase"
        }}
      >
        TEAM {teamName}<br />YOU ARE DISQUALIFIED
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 3 }}
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "1.2rem",
          color: "rgba(255, 255, 255, 0.5)",
          letterSpacing: "4px"
        }}
      >
        Reason: {displayReason}
      </motion.div>
    </motion.div>
  );
};

const ComplexInput = ({ icon: Icon, placeholder, value, setter, fieldId, activeInput, setActiveInput }) => {
  const isFocused = activeInput === fieldId;
  const isFilled = value.length > 0;

  return (
    <div style={{ position: "relative", marginBottom: "16px", width: "100%", display: "flex", justifyContent: "center" }}>

      {/* Futuristic ornate input container with bevel */}
      <div style={{
        position: "relative",
        width: "90%",
        height: "54px",
        background: isFocused ? "linear-gradient(90deg, rgba(212,175,55,0.15) 0%, rgba(10,10,12,0.97) 20%, rgba(10,10,12,0.97) 80%, rgba(212,175,55,0.15) 100%)" : "linear-gradient(180deg, rgba(20,20,20,0.9) 0%, rgba(5,5,5,0.98) 100%)",
        clipPath: "polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)",
        border: "none",
        transition: "all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)",
        display: "flex",
        alignItems: "center",
        boxShadow: isFocused
          ? "0 0 0 1px rgba(212,175,55,0.6), 0 0 40px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.03)"
      }}>
        {/* Bevel Outline using inset clip-path */}
        <div style={{
          position: "absolute",
          inset: "1px",
          background: isFocused
            ? "linear-gradient(180deg, rgba(25,22,10,0.98) 0%, rgba(5,5,5,0.99) 100%)"
            : "linear-gradient(180deg, #151515 0%, #000 100%)",
          clipPath: "polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)",
          transition: "all 0.5s",
          zIndex: 0
        }} />

        {/* Top scan line on focus */}
        {isFocused && (
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "1px",
              background: "linear-gradient(90deg, transparent, #FFDF73, #D4AF37, #FFDF73, transparent)",
              boxShadow: "0 0 12px rgba(255,223,115,0.9)",
              transformOrigin: "left",
              zIndex: 3
            }}
          />
        )}
        {/* Bottom scan line on focus */}
        {isFocused && (
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), rgba(212,175,55,0.8), rgba(212,175,55,0.5), transparent)",
              boxShadow: "0 0 6px rgba(212,175,55,0.5)",
              transformOrigin: "right",
              zIndex: 3
            }}
          />
        )}

        {/* Glowing Side Accents */}
        <div style={{ position: "absolute", left: 0, top: "15%", bottom: "15%", width: "2px", background: isFocused ? "linear-gradient(180deg, transparent, #FFDF73, #D4AF37, transparent)" : "rgba(255,255,255,0.03)", boxShadow: isFocused ? "0 0 20px rgba(255,223,115,0.8)" : "none", transition: "all 0.5s ease", zIndex: 2 }} />
        <div style={{ position: "absolute", right: 0, top: "15%", bottom: "15%", width: "2px", background: isFocused ? "linear-gradient(180deg, transparent, #FFDF73, #D4AF37, transparent)" : "rgba(255,255,255,0.03)", boxShadow: isFocused ? "0 0 20px rgba(255,223,115,0.8)" : "none", transition: "all 0.5s ease", zIndex: 2 }} />

        <div style={{
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          borderRight: `1px solid ${isFocused ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.05)'}`,
          height: "70%",
          transition: "all 0.4s",
          zIndex: 2
        }}>
          <Icon size={18} color={isFocused ? "#FFDF73" : "rgba(255,255,255,0.2)"} style={{ filter: isFocused ? "drop-shadow(0 0 10px rgba(255,223,115,1))" : "none", transition: "all 0.4s" }} />
        </div>

        <div style={{ position: "relative", flex: 1, height: "100%", zIndex: 2 }}>
          <div style={{
            position: "absolute",
            top: (isFocused || isFilled) ? "6px" : "19px",
            left: "16px",
            fontSize: (isFocused || isFilled) ? "9px" : "11px",
            letterSpacing: "4px",
            color: (isFocused || isFilled) ? "#FFDF73" : "rgba(255,255,255,0.25)",
            textTransform: "uppercase",
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 600,
            pointerEvents: "none",
            transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
            textShadow: (isFocused || isFilled) ? "0 0 8px rgba(255,223,115,0.6)" : "none"
          }}>
            {placeholder}
          </div>

          <input
            value={value}
            onChange={e => setter(e.target.value.toUpperCase())}
            onFocus={() => setActiveInput(fieldId)}
            onBlur={() => setActiveInput(null)}
            required
            style={{
              width: "100%",
              height: "100%",
              background: "transparent",
              border: "none",
              color: "#fff",
              padding: "18px 16px 0",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              letterSpacing: "3px",
              outline: "none",
              caretColor: "#FFDF73"
            }}
          />
        </div>
      </div>
    </div>
  );
};

const RegistrationScreen = ({ onRegister }) => {
  const [teamName, setTeamName] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [registering, setRegistering] = useState(false);
  const [activeInput, setActiveInput] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!teamName || !p1 || !p2) return;

    setRegistering(true);
    try {
      const res = await fetch(`${API}/api/game/teams/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, player1: p1, player2: p2, role: "observer" })
      });
      const data = await res.json();

      if (data.success && data.team) {
        onRegister({
          id: data.team._id,
          name: data.team.name,
          player1: data.team.observer,
          player2: data.team.creator,
          status: data.team.status,
          round: data.team.round
        });
      } else {
        alert(data.error || "Registration failed on server.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to backend for registration.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{
      height: "100vh",
      width: "100%",
      position: "relative",
      backgroundColor: "#030303",
      backgroundImage: `url(${BG_IMAGES[0] || ''})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    }}>
      {/* Deep cinematic vignette + golden center bloom */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(40,30,5,0.4) 0%, rgba(5,4,0,0.75) 55%, rgba(0,0,0,0.99) 100%)", zIndex: 1 }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 35% 25% at 50% 50%, rgba(212,175,55,0.09) 0%, transparent 70%)", zIndex: 1 }} />

      {/* Horizontal cinematic light streaks */}
      {[12, 32, 50, 68, 85].map((top, i) => (
        <motion.div
          key={`streak-${i}`}
          animate={{ scaleX: [0, 1, 0], opacity: [0, 0.14 - i * 0.015, 0] }}
          transition={{ duration: 7 + i * 1.8, repeat: Infinity, ease: "easeInOut", delay: i * 3.2 + 0.5 }}
          style={{
            position: "absolute",
            top: `${top}%`,
            left: 0, right: 0,
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.8), rgba(255,223,115,1), rgba(212,175,55,0.8), transparent)",
            transformOrigin: i % 2 === 0 ? "left" : "right",
            zIndex: 1,
            pointerEvents: "none"
          }}
        />
      ))}

      {/* High-End Volumetric Sparks */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", overflow: "hidden" }}>
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: ["100vh", "-10vh"],
              x: [Math.random() * 30 - 15, Math.random() * 60 - 30],
              opacity: [0, Math.random() * 0.8 + 0.2, 0],
              scale: [0, Math.random() * 1.5 + 0.5, 0]
            }}
            transition={{
              duration: Math.random() * 8 + 8,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * 10
            }}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              background: "linear-gradient(180deg, #FFFFFF 0%, #FFDF73 50%, #D4AF37 100%)",
              borderRadius: "50%",
              boxShadow: "0 0 20px #FFDF73, 0 0 5px #FFFFFF",
              filter: "blur(0.5px)"
            }}
          />
        ))}
      </div>

      {/* Outer ring — slow rotation with bright arc */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 200, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute",
          width: "130vh", height: "130vh",
          borderRadius: "50%",
          border: "1px solid rgba(212,175,55,0.04)",
          borderTop: "2px solid rgba(212,175,55,0.28)",
          borderBottom: "1px solid rgba(212,175,55,0.1)",
          zIndex: 1,
          boxShadow: "0 0 80px rgba(212,175,55,0.07), inset 0 0 80px rgba(212,175,55,0.03)"
        }}
      />
      {/* Middle counter-rotating ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 300, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute",
          width: "108vh", height: "108vh",
          borderRadius: "50%",
          border: "1px solid transparent",
          borderLeft: "2px solid rgba(212,175,55,0.2)",
          borderRight: "1px solid rgba(212,175,55,0.06)",
          zIndex: 1
        }}
      />
      {/* Inner pulsing ring */}
      <motion.div
        animate={{ scale: [1, 1.04, 1], opacity: [0.25, 0.6, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          width: "86vh", height: "86vh",
          borderRadius: "50%",
          border: "1px solid rgba(212,175,55,0.18)",
          zIndex: 1,
          boxShadow: "0 0 50px rgba(212,175,55,0.08), inset 0 0 50px rgba(212,175,55,0.05)"
        }}
      />

      <div style={{
        position: "relative",
        zIndex: 10,
        width: "100%",
        maxWidth: "950px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        perspective: "1000px"
      }}>

        {/* Left Ornate Pillar (3D Metallic) */}
        <motion.div
          initial={{ opacity: 0, x: -80, rotateY: 15 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            width: "60px",
            height: "450px",
            background: "linear-gradient(90deg, #050505 0%, #2a2a2a 30%, #444 50%, #2a2a2a 70%, #050505 100%)",
            clipPath: "polygon(20px 0, 40px 0, 60px 25px, 60px calc(100% - 25px), 40px 100%, 20px 100%, 0 calc(100% - 25px), 0 25px)",
            position: "absolute",
            left: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "40px 0",
            boxShadow: "20px 0 50px rgba(0,0,0,0.9)",
            zIndex: 15
          }}
        >
          {/* Inner Pillar Engraving */}
          <div style={{ position: "absolute", inset: "2px", background: "linear-gradient(180deg, #0e0e0e 0%, #050505 100%)", clipPath: "polygon(19px 0, 39px 0, 58px 24px, 58px calc(100% - 24px), 39px 100%, 19px 100%, 0 calc(100% - 24px), 0 24px)", zIndex: 0 }} />
          {/* Pillar inner glow line */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "1px", background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.15), rgba(212,175,55,0.3), rgba(212,175,55,0.15), transparent)", transform: "translateX(-50%)", zIndex: 0 }} />
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ width: "2px", height: "80px", background: "linear-gradient(180deg, transparent, #FFDF73, #D4AF37, transparent)", zIndex: 1, boxShadow: "0 0 20px rgba(255,223,115,0.8)" }} />
          <div style={{ writingMode: "vertical-rl", fontFamily: "'Cinzel', serif", color: "#D4AF37", letterSpacing: "10px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", transform: "rotate(180deg)", zIndex: 1, textShadow: "0 0 15px rgba(212,175,55,0.7), 0 0 30px rgba(212,175,55,0.3)" }}>
            Alpha
          </div>
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }} style={{ width: "2px", height: "80px", background: "linear-gradient(180deg, transparent, #FFDF73, #D4AF37, transparent)", zIndex: 1, boxShadow: "0 0 20px rgba(255,223,115,0.8)" }} />
        </motion.div>

        {/* Right Ornate Pillar — Premium metallic */}
        <motion.div
          initial={{ opacity: 0, x: 100, rotateY: -25 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "60px",
            height: "450px",
            background: "linear-gradient(90deg, #050505 0%, #1e1e1e 25%, #3a3a3a 50%, #1e1e1e 75%, #050505 100%)",
            clipPath: "polygon(20px 0, 40px 0, 60px 25px, 60px calc(100% - 25px), 40px 100%, 20px 100%, 0 calc(100% - 25px), 0 25px)",
            position: "absolute",
            right: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "40px 0",
            boxShadow: "-20px 0 60px rgba(0,0,0,0.95), 0 0 40px rgba(212,175,55,0.08)",
            zIndex: 15
          }}
        >
          <div style={{ position: "absolute", inset: "2px", background: "linear-gradient(180deg, #0e0e0e 0%, #050505 100%)", clipPath: "polygon(19px 0, 39px 0, 58px 24px, 58px calc(100% - 24px), 39px 100%, 19px 100%, 0 calc(100% - 24px), 0 24px)", zIndex: 0 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "1px", background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.15), rgba(212,175,55,0.3), rgba(212,175,55,0.15), transparent)", transform: "translateX(-50%)", zIndex: 0 }} />
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} style={{ width: "2px", height: "80px", background: "linear-gradient(180deg, transparent, #FFDF73, #D4AF37, transparent)", zIndex: 1, boxShadow: "0 0 20px rgba(255,223,115,0.8)" }} />
          <div style={{ writingMode: "vertical-rl", fontFamily: "'Cinzel', serif", color: "#D4AF37", letterSpacing: "10px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", zIndex: 1, textShadow: "0 0 15px rgba(212,175,55,0.7), 0 0 30px rgba(212,175,55,0.3)" }}>
            Omega
          </div>
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2.3 }} style={{ width: "2px", height: "80px", background: "linear-gradient(180deg, transparent, #FFDF73, #D4AF37, transparent)", zIndex: 1, boxShadow: "0 0 20px rgba(255,223,115,0.8)" }} />
        </motion.div>

        {/* Central Hexagonal Core Structure — no floating, stationary */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: "relative", width: "100%", maxWidth: "600px", zIndex: 10, display: "flex", justifyContent: "center" }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              position: "relative",
              width: "100%",
              background: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz4KPC9zdmc+') repeat, linear-gradient(180deg, rgba(20,18,10,0.85) 0%, rgba(5,5,5,0.95) 100%)",
              backdropFilter: "blur(30px) saturate(120%)",
              WebkitBackdropFilter: "blur(30px) saturate(120%)",
              clipPath: "polygon(45px 0, calc(100% - 45px) 0, 100% 45px, 100% calc(100% - 45px), calc(100% - 45px) 100%, 45px 100%, 0 calc(100% - 45px), 0 45px)",
              padding: "60px 40px 40px",
              boxShadow: "0 40px 120px rgba(0,0,0,1), inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 20px rgba(212,175,55,0.15)",
            }}
          >
          {/* Animated Liquid Gold Vault Border */}
          <motion.div 
            animate={{ backgroundPosition: ["0% 0%", "200% 200%"] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute", inset: "0",
              background: "linear-gradient(135deg, #FFDF73 0%, #D4AF37 25%, #8a6a1c 50%, #D4AF37 75%, #FFDF73 100%)",
              backgroundSize: "300% 300%",
              clipPath: "polygon(45px 0, calc(100% - 45px) 0, 100% 45px, 100% calc(100% - 45px), calc(100% - 45px) 100%, 45px 100%, 0 calc(100% - 45px), 0 45px)",
              zIndex: 0
            }} 
          />
          <div style={{
            position: "absolute", inset: "3px",
            background: "linear-gradient(180deg, rgba(10,10,10,0.9) 0%, rgba(2,2,2,0.98) 100%)",
            backdropFilter: "blur(10px)",
            clipPath: "polygon(43px 0, calc(100% - 43px) 0, 100% 43px, 100% calc(100% - 43px), calc(100% - 43px) 100%, 43px 100%, 0 calc(100% - 43px), 0 43px)",
            zIndex: 0
          }} />
          <div style={{
            position: "absolute", inset: "10px",
            border: "1px solid rgba(212,175,55,0.15)",
            clipPath: "polygon(38px 0, calc(100% - 38px) 0, 100% 38px, 100% calc(100% - 38px), calc(100% - 38px) 100%, 38px 100%, 0 calc(100% - 38px), 0 38px)",
            zIndex: 0
          }} />

          {/* 4 Golden Corner Accents */}
          {[
            { top: "12px", left: "12px", borderTop: "2px solid #FFDF73", borderLeft: "2px solid #FFDF73", boxShadow: "inset 0 0 10px rgba(255,223,115,0.4), -3px -3px 12px rgba(255,223,115,0.5)" },
            { top: "12px", right: "12px", borderTop: "2px solid #FFDF73", borderRight: "2px solid #FFDF73", boxShadow: "inset 0 0 10px rgba(255,223,115,0.4), 3px -3px 12px rgba(255,223,115,0.5)" },
            { bottom: "12px", left: "12px", borderBottom: "2px solid #FFDF73", borderLeft: "2px solid #FFDF73", boxShadow: "inset 0 0 10px rgba(255,223,115,0.4), -3px 3px 12px rgba(255,223,115,0.5)" },
            { bottom: "12px", right: "12px", borderBottom: "2px solid #FFDF73", borderRight: "2px solid #FFDF73", boxShadow: "inset 0 0 10px rgba(255,223,115,0.4), 3px 3px 12px rgba(255,223,115,0.5)" }
          ].map((style, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 1.2 + i * 0.1 }}
              style={{
                position: "absolute",
                width: "24px", height: "24px",
                zIndex: 4,
                ...style
              }}
            />
          ))}

          {/* Slow Ambient Scanner Sweep (horizontal line that sweeps top-to-bottom once) */}
          <motion.div
            initial={{ top: "10%", opacity: 0 }}
            animate={{ top: ["10%", "90%", "10%"], opacity: [0, 0.6, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
            style={{
              position: "absolute", left: "10px", right: "10px", height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.8), rgba(255,223,115,1), rgba(212,175,55,0.8), transparent)",
              boxShadow: "0 0 15px rgba(255,223,115,0.6)",
              zIndex: 3,
              pointerEvents: "none"
            }}
          />

          {/* Pulsing amber ambient inner glow at bottom */}
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "60px",
              background: "radial-gradient(ellipse at 50% 100%, rgba(212,175,55,0.25) 0%, transparent 70%)",
              zIndex: 3,
              pointerEvents: "none"
            }}
          />

          {/* Top Overlapping Royal Crest */}
          <div style={{
            position: "absolute",
            top: "-20px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "110px",
            height: "70px",
            background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 20,
            boxShadow: "0 10px 20px rgba(0,0,0,1)"
          }}>
            {/* Crest Bevel */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #D4AF37 0%, #664d0c 100%)", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", zIndex: 0 }} />
            <div style={{ position: "absolute", inset: "2px", background: "#0a0a0a", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", zIndex: 0 }} />
            <motion.img
              src={gdgLogo} alt="GDG"
              animate={{ filter: ["drop-shadow(0 0 10px rgba(212,175,55,0.5))", "drop-shadow(0 0 20px rgba(212,175,55,1))", "drop-shadow(0 0 10px rgba(212,175,55,0.5))"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 40, zIndex: 1, position: "relative" }}
            />
          </div>

          <div style={{ position: "relative", zIndex: 5, textAlign: "center", marginTop: "10px", marginBottom: "24px" }}>
            {/* Cinematic Lens Flare */}
            <motion.div 
              animate={{ opacity: [0.4, 0.8, 0.4], scaleX: [1, 1.5, 1] }} 
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "120%", height: "2px", background: "radial-gradient(ellipse at center, rgba(212,175,55,0.8) 0%, transparent 70%)", filter: "blur(2px)", zIndex: -1 }} 
            />
            <motion.div 
              animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }} 
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "80%", height: "40px", background: "radial-gradient(ellipse at center, rgba(212,175,55,0.3) 0%, transparent 70%)", filter: "blur(10px)", zIndex: -1 }} 
            />
            
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "10px", letterSpacing: "10px", color: "rgba(212,175,55,0.9)", textTransform: "uppercase", marginBottom: "8px", fontWeight: 700, textShadow: "0 0 10px rgba(212,175,55,0.4)" }}>
              Sector Unlocked
            </div>
            <motion.h1 
              initial={{ letterSpacing: "30px", opacity: 0, filter: "blur(10px)" }}
              animate={{ letterSpacing: "10px", opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
              style={{ position: "relative", fontFamily: "'Cinzel', serif", fontSize: "44px", fontWeight: "900", color: "#fff", margin: 0, textShadow: "0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.8)" }}
            >
              <span style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFDF73 30%, #D4AF37 60%, #8A6A1C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", position: "relative", zIndex: 2 }}>MAYAVYUH</span>
            </motion.h1>

            {/* Highly Intricate Royal Divider */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", margin: "16px 0" }}>
              <div style={{ width: "35%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,1))" }} />
              <div style={{ width: "8px", height: "8px", transform: "rotate(45deg)", border: "2px solid #D4AF37" }} />
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [45, 225] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                style={{ width: "5px", height: "5px", background: "#D4AF37", boxShadow: "0 0 20px #D4AF37" }}
              />
              <div style={{ width: "8px", height: "8px", transform: "rotate(45deg)", border: "2px solid #D4AF37" }} />
              <div style={{ width: "35%", height: "1px", background: "linear-gradient(270deg, transparent, rgba(212,175,55,1))" }} />
            </div>

            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px" }}>
              Synchronize sequence to enter the labyrinth.
            </p>
          </div>

          <form onSubmit={handleRegister} style={{ position: "relative", zIndex: 5, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>

            <motion.div initial={{ opacity: 0, x: -50, filter: "blur(10px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: "easeOut", delay: 1.0 }} style={{ width: "100%" }}>
              <ComplexInput icon={Shield} placeholder="HOUSE DESIGNATION" value={teamName} setter={setTeamName} fieldId="team" activeInput={activeInput} setActiveInput={setActiveInput} />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 50, filter: "blur(10px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: "easeOut", delay: 1.2 }} style={{ width: "100%" }}>
              <ComplexInput icon={User} placeholder="OPERATIVE I IDENTIFIER" value={p1} setter={setP1} fieldId="p1" activeInput={activeInput} setActiveInput={setActiveInput} />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -50, filter: "blur(10px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: "easeOut", delay: 1.4 }} style={{ width: "100%" }}>
              <ComplexInput icon={Users} placeholder="OPERATIVE II IDENTIFIER" value={p2} setter={setP2} fieldId="p2" activeInput={activeInput} setActiveInput={setActiveInput} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
              style={{ width: "95%", marginTop: "12px" }}
            >
              <button
                type="submit"
                disabled={registering}
                style={{
                  width: "100%",
                  height: "56px",
                  background: "linear-gradient(90deg, rgba(212,175,55,0.2) 0%, rgba(255,223,115,0.5) 50%, rgba(212,175,55,0.2) 100%)",
                  clipPath: "polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)",
                  border: "none",
                  color: "#fff",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 900,
                  fontSize: "16px",
                  letterSpacing: "6px",
                  cursor: registering ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  transition: "all 0.5s cubic-bezier(0.19, 1, 0.22, 1)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.4), inset 0 0 20px rgba(255,223,115,0.2)",
                  textTransform: "uppercase",
                  position: "relative",
                  overflow: "hidden"
                }}
                onMouseOver={(e) => {
                  if (!registering) {
                    e.currentTarget.style.background = "linear-gradient(90deg, rgba(255,223,115,0.6) 0%, rgba(255,255,255,0.9) 50%, rgba(255,223,115,0.6) 100%)";
                    e.currentTarget.style.boxShadow = "0 15px 40px rgba(0,0,0,0.9), 0 0 60px rgba(255,223,115,0.8), inset 0 0 30px rgba(255,255,255,0.5)";
                    e.currentTarget.style.transform = "scale(1.02) translateY(-2px)";
                    if (e.currentTarget.children[0]) e.currentTarget.children[0].style.opacity = "0.2";
                    e.currentTarget.style.textShadow = "0 0 15px rgba(255,255,255,1)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!registering) {
                    e.currentTarget.style.background = "linear-gradient(90deg, rgba(212,175,55,0.2) 0%, rgba(255,223,115,0.5) 50%, rgba(212,175,55,0.2) 100%)";
                    e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.4), inset 0 0 20px rgba(255,223,115,0.2)";
                    e.currentTarget.style.transform = "scale(1) translateY(0)";
                    if (e.currentTarget.children[0]) e.currentTarget.children[0].style.opacity = "0.9";
                    e.currentTarget.style.textShadow = "none";
                  }
                }}
              >
                {/* Thick Button Bevel Outline */}
                <div style={{ position: "absolute", inset: "2px", background: "linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(5,5,5,0.98) 100%)", clipPath: "polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)", zIndex: -1, transition: "opacity 0.4s", opacity: 0.9 }} />

                {/* Sweep animation div */}
                <motion.div
                  initial={{ left: "-100%" }}
                  animate={{ left: "200%" }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
                  style={{ position: "absolute", top: 0, width: "30%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)", transform: "skewX(-20deg)", zIndex: 0 }}
                />

                <span style={{ position: "relative", zIndex: 1 }}>{registering ? "SYNCHRONIZING..." : "ENTER SANCTUM"}</span>
              </button>
            </motion.div>

          </form>
        </motion.div>
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
    {timeLeft > 0 && <div style={{ fontSize: 48, fontFamily: "'Orbitron'", color: "#D4AF37", marginBottom: 32 }}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>}
    <div style={{ fontFamily: "'Cinzel', serif", color: "var(--neon-cyan)", letterSpacing: 4 }}>AWAITING PROTOCOL...</div>
  </div>
);

const RoundDisplay = ({ playerLabel, targetImage, onComplete, roundLabel, storageKey, isPaused, timeLeft, isRoundEnded, teamId, registerGeminiWindow }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedImgUrl, setUploadedImgUrl] = useState(null);
  const [isGeminiLaunched, setIsGeminiLaunched] = useState(false);
  const [geminiLink, setGeminiLink] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [savedSessionLink, setSavedSessionLink] = useState(() => localStorage.getItem(`gemini_session_${teamId}_${storageKey}`) || "");
  const [tempSessionLink, setTempSessionLink] = useState("");

  const isTimeUp = timeLeft <= 0;
  const effectivelyEnded = isRoundEnded || isTimeUp;

  useEffect(() => {
    if (isPaused || effectivelyEnded) setIsGeminiLaunched(false);
  }, [isPaused, effectivelyEnded]);

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleOpenGemini = () => {
    const sw = window.screen.availWidth;
    const sh = window.screen.availHeight;
    const half = Math.floor(sw / 2);
    const geminiWin = window.open('https://gemini.google.com', 'GeminiPopup', `width=${half},height=${sh},left=${half},top=0`);
    if (registerGeminiWindow) registerGeminiWindow(geminiWin);
    try {
      window.moveTo(0, 0);
      window.resizeTo(half, sh);
    } catch (e) { console.warn("Browser blocked window resize", e); }
    setIsGeminiLaunched(true);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);
    if (teamId) formData.append("teamId", teamId);
    if (storageKey) formData.append("round", storageKey.replace('r', ''));
    try {
      const uploadRes = await fetch(`${API}/api/player/upload-submission`, { method: "POST", body: formData });
      const data = await uploadRes.json();
      if (!data.success) throw new Error(data.error || data.message || "Upload failed");
      setUploadedImgUrl(data.url);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const linkToVerify = geminiLink.trim() || savedSessionLink;
    if (!linkToVerify) {
      alert("SECURITY LOCK: You must paste your Gemini Chat Link to verify this spell.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`${API}/api/verify-gemini`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: linkToVerify })
      });
      const data = await res.json();
      if (!res.ok) {
        alert("LOCK REJECTED: " + (data.error || "Verification failed."));
        return;
      }
      onComplete(uploadedImgUrl, linkToVerify);
    } catch (err) {
      alert("Error verifying the Gemini link.");
    } finally {
      setVerifying(false);
    }
  };

  if (isGeminiLaunched) {
    return (
      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ac-protected-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: "50vw", padding: "32px 40px", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div style={{ fontSize: 40, fontFamily: "'Orbitron'", color: (isPaused || effectivelyEnded) ? "#ff2a2a" : "#D4AF37", textShadow: `0 0 10px ${(isPaused || effectivelyEnded) ? 'rgba(255,42,42,0.5)' : 'rgba(212,175,55,0.5)'}`, letterSpacing: 2, marginTop: 4 }}>
            {(isPaused || effectivelyEnded) ? "00:00" : fmtTime(timeLeft)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <div className="title-secondary" style={{ marginBottom: 0, border: "none", fontSize: 24, letterSpacing: 2, color: "var(--neon-cyan)" }}>{roundLabel}</div>
          </div>
        </div>

        <motion.div layout className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px", width: "100%", maxWidth: "800px", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
            <div className="title-secondary" style={{ marginBottom: 0, fontSize: 20 }}>TARGET DATACRON</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <div style={{ color: "var(--neon-cyan)", fontSize: 10, letterSpacing: 2 }}>SAVE GEMINI LINK (FOR REFRESH)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="url" placeholder="Paste Gemini URL..." value={savedSessionLink || tempSessionLink} onChange={e => setTempSessionLink(e.target.value)} readOnly={!!savedSessionLink} style={{ padding: "6px 10px", background: "rgba(0,0,0,0.5)", border: "1px solid var(--neon-cyan)", color: "#fff", fontFamily: "'Share Tech Mono'", outline: "none", borderRadius: 4, width: 220, fontSize: 12, opacity: savedSessionLink ? 0.6 : 1 }} />
                {!savedSessionLink && (
                  <button className="btn-imperial" style={{ padding: "6px 12px", fontSize: 12, borderColor: "var(--neon-green)", color: "var(--neon-green)" }} onClick={() => { if (tempSessionLink.includes('gemini.google.com')) { localStorage.setItem(`gemini_session_${teamId}_${storageKey}`, tempSessionLink); setSavedSessionLink(tempSessionLink); } else { alert("Please enter a valid Gemini link."); } }}>SAVE</button>
                )}
              </div>
            </div>
          </div>

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
                <span style={{ color: uploading ? "var(--text-dim)" : "var(--neon-cyan)", fontSize: 16, letterSpacing: 2, fontFamily: "'Orbitron'", fontWeight: "bold" }}>{uploading ? "UPLOADING ARTIFACT..." : "UPLOAD GENERATED IMAGE"}</span>
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
                <div style={{ color: "var(--neon-cyan)", fontSize: 12, marginBottom: 8, letterSpacing: 2 }}>{savedSessionLink ? "GEMINI CHAT LINK (SAVED):" : "GEMINI CHAT LINK (MANDATORY):"}</div>
                <input type="url" placeholder="https://gemini.google.com/app/..." value={geminiLink} onChange={e => setGeminiLink(e.target.value)} style={{ width: "100%", padding: "16px", background: "rgba(0,0,0,0.5)", border: "1px solid var(--neon-cyan)", color: "#fff", fontFamily: "'Share Tech Mono'", outline: "none", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <button className="btn-imperial-danger" style={{ flex: 1, padding: 16 }} onClick={() => setUploadedImgUrl(null)}>RETRY</button>
                <button className="btn-imperial" style={{ flex: 2, padding: 16, borderColor: "var(--neon-green)", color: "var(--neon-green)", opacity: verifying ? 0.5 : 1 }} onClick={handleSubmit} disabled={verifying}>{verifying ? "VERIFYING..." : "SUBMIT TO DATACRON ➔"}</button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div layout className="chat-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="chat-sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <img src={gdgLogo} alt="GDG Logo" style={{ width: 40 }} />
          <div className="title-secondary" style={{ marginBottom: 0, border: "none" }}>{roundLabel}</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono'", color: "var(--neon-cyan)", marginBottom: 24, fontSize: 14 }}>{playerLabel} IS AT THE TERMINAL</div>
        <div style={{ textAlign: "center", marginBottom: 24, background: "rgba(0,0,0,0.5)", padding: 16, border: "1px solid rgba(212,175,55,0.2)" }}>
          <div style={{ fontSize: 32, fontFamily: "'Orbitron'", color: (isPaused || effectivelyEnded) ? "#ff2a2a" : "#D4AF37", textShadow: `0 0 10px ${(isPaused || effectivelyEnded) ? 'rgba(255,42,42,0.5)' : 'rgba(212,175,55,0.5)'}` }}>
            {(isPaused || effectivelyEnded) ? "00:00" : fmtTime(timeLeft)}
          </div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: (isPaused || effectivelyEnded) ? "#ff2a2a" : "rgba(212,175,55,0.6)" }}>
            {isPaused ? "TEMPORAL HALT" : (effectivelyEnded ? "PHASE SEALED" : "TIME REMAINING")}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ color: "var(--text-dim)", marginBottom: 8, fontSize: 14 }}>TARGET DATACRON:</div>
          <motion.div layout className="glass-panel" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, maxHeight: 400, overflow: "hidden" }}>
            {targetImage ? <motion.img layoutId="target-image" src={targetImage} alt="target" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ color: "var(--text-dim)", fontFamily: "'Orbitron'" }}>NO TARGET</div>}
          </motion.div>
        </div>
      </div>
      <motion.div layout className="chat-main" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
        {effectivelyEnded ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <div style={{ fontFamily: "'Orbitron'", fontSize: 24, color: "var(--neon-red)" }}>PHASE SEALED</div>
            <div style={{ color: "var(--text-dim)", marginTop: 16 }}>This phase has been closed.</div>
          </div>
        ) : (
          <div className="glass-panel" style={{ width: "100%", maxWidth: 600, textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>✨</div>
            <div style={{ fontFamily: "'Orbitron'", fontSize: 24, color: "var(--neon-gold)", marginBottom: 16 }}>SPELL GENERATION</div>
            <div style={{ color: "var(--text-dim)", marginBottom: 32, lineHeight: 1.6 }}>Launch Gemini in Split-Screen Mode to generate your spell.<br />Your target image will remain visible here.</div>
            <button className="btn-imperial" onClick={handleOpenGemini} style={{ width: "100%", padding: 20, fontSize: 16, display: "flex", justifyContent: "center", gap: 12 }}>{savedSessionLink ? "RE-CONTINUE GEMINI SESSION ➔" : "LAUNCH GEMINI (SPLIT SCREEN) ➔"}</button>
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
  const [timeLeft, setTimeLeft] = useState(5);

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
  const sorted = [...teams].filter(t => t.score).sort((a, b) => b.score - a.score).slice(0, 3);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
      <img src={gdgLogo} alt="GDG Logo" style={{ width: 80, marginBottom: 20 }} />
      <div className="title-primary" style={{ marginBottom: 40 }}>FINAL LEADERBOARD</div>
      <div className="glass-panel" style={{ width: 600 }}>
        {sorted.map((t, i) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: i < 2 ? "1px solid var(--glass-border)" : "none", fontSize: 24, fontFamily: "'Orbitron'" }}>
            <div style={{ color: i === 0 ? "var(--neon-gold)" : i === 1 ? "silver" : "#cd7f32" }}>#{i + 1} {t.name}</div>
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

  const [disqualifiedReason, setDisqualifiedReason] = usePersistentState("maya_disqualified", null);
  const [phase, setPhase] = usePersistentState("maya_phase", "register");
  const [targetImage, setTargetImage] = usePersistentState("maya_targetImage", null);
  const [r1Img, setR1Img] = usePersistentState("maya_r1Img", null);
  const [r2Img, setR2Img] = usePersistentState("maya_r2Img", null);
  const [r3Img, setR3Img] = usePersistentState("maya_r3Img", null);
  const [finalImg, setFinalImg] = usePersistentState("maya_finalImg", null);
  const [score, setScore] = usePersistentState("maya_score", null);

  const [session, setSession] = useState(null);

  const handleDisqualify = useCallback((reason) => {
    if (!myTeam) return;
    setDisqualifiedReason(reason);

    // Broadcast ban to admin instantly
    setGlobalTeams(prev => prev.map(t => t.id === myTeam.id ? { ...t, status: "banned" } : t));

    // Try to update backend if endpoint exists (fire and forget)
    fetch(`${API}/api/game/teams/${myTeam.id}/ban`, { method: "POST" }).catch(() => { });
  }, [myTeam, setDisqualifiedReason, setGlobalTeams]);

  useEffect(() => {
    if (!myTeam) return;
    const fetchSession = async () => {
      try {
        const res = await fetch(`${API}/api/game/status`);
        const data = await res.json();
        if (data.session) setSession(data.session);
      } catch (err) { }
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
    else if (s === 'round1_active' && phase !== 'r1') {
      fetch(`${API}/api/target-image`)
        .then(r => r.json())
        .then(d => { setTargetImage(d.url); setPhase("r1"); })
        .catch(e => setPhase("r1"));
    }
    else if (s === 'round2_active' && phase !== 'r2') {
      setPhase("r2");
    }
    else if (s === 'round3_active' && phase !== 'r3') {
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

  const isPaused = session?.isPaused || false;
  const forceCloseWindow = isPaused || (timeLeft <= 0 && session?.status?.includes('_active'));

  // Anti-cheat hook — active only for player view
  const { registerGeminiWindow } = useAntiCheat({
    isPlayer: true,
    teamId: myTeam?.id || null,
    onDisqualify: handleDisqualify,
    isPaused,
    forceCloseWindow
  });

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
    setDisqualifiedReason(null);

    setMyTeam(t);
    setGlobalTeams(prev => [...prev, t]);
    setPhase("lobby");
  };

  const updateTeamStatus = (updates) => {
    setGlobalTeams(prev => prev.map(t => t.id === myTeam.id ? { ...t, ...updates } : t));
  };

  if (!myTeam) return <RegistrationScreen onRegister={handleRegister} />;

  if (disqualifiedReason) {
    return <DisqualifiedScreen teamName={myTeam.name} reason={disqualifiedReason} />;
  }

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

  const status = session?.status || 'waiting';

  // Common props passed to all RoundDisplay instances
  const roundProps = { teamId: myTeam.id, isPaused, timeLeft, registerGeminiWindow };

  if (phase === "lobby") return <LobbyScreen />;
  if (phase === "r1") return <RoundDisplay {...roundProps} storageKey="r1" playerLabel={`PLAYER 1 (${myTeam.player1})`} targetImage={targetImage} roundLabel="ROUND 1: INITIAL CREATION" onComplete={(img, link) => { setR1Img(img); updateTeamStatus({ round: 1, r1Link: link }); setPhase("interval1"); }} isRoundEnded={status === 'round1_ended'} />;
  if (phase === "interval1") return <IntervalScreen title="VERBAL TRANSFER" message={`PLAYER 1 (${myTeam.player1}), describe the target image to PLAYER 2 (${myTeam.player2}) verbally. Do not show them the screen!`} timeLeft={timeLeft} />;
  if (phase === "r2") return <RoundDisplay {...roundProps} storageKey="r2" playerLabel={`PLAYER 2 (${myTeam.player2})`} targetImage={r1Img} roundLabel="ROUND 2: BLIND RECREATION" onComplete={(img, link) => { setR2Img(img); updateTeamStatus({ round: 2, r2Link: link }); setPhase("wait_for_r3"); }} isRoundEnded={status === 'round2_ended'} />;
  if (phase === "wait_for_r3") return <IntervalScreen title="HOLD POSITION" message="AWAITING ADMIN PROTOCOL FOR ROUND 3" timeLeft={timeLeft} />;
  if (phase === "r3") return <RoundDisplay {...roundProps} storageKey="r3" playerLabel={`PLAYER 1 (${myTeam.player1})`} targetImage={r2Img} roundLabel="ROUND 3: REFINEMENT" onComplete={(img, link) => { setR3Img(img); updateTeamStatus({ r3Link: link }); setPhase("select"); }} isRoundEnded={status === 'round3_ended'} />;
  if (phase === "select") return <SelectionScreen imgR2={r2Img} imgR3={r3Img} onSelect={async (img) => {
    setFinalImg(img);
    setPhase("judgment");
    try {
      const res = await fetch(`${API}/api/similarity`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_url: targetImage, submitted_url: img })
      });
      const data = await res.json();
      const s = data.similarity_score || 0;
      setScore(s);
      updateTeamStatus({ round: 3, score: s, finalImage: img });
    } catch (e) {
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
  const getView = () => { const h = window.location.hash; if (h === "#admin") return "admin"; return "player"; };
  const [view, setView] = useState(getView);
  useEffect(() => { const h = () => setView(getView()); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);

  const [teams, setTeams] = useSyncState("maya_teams", INIT_TEAMS);
  const [eventState, setEventState] = useSyncState("maya_event", INIT_EVENT);

  return (
    <>
      <GlobalStyles />
      {/* Anti-cheat violation banner — rendered once at root, shown by JS */}
      <div id="ac-violation-banner" className="ac-violation-banner" aria-hidden="true" />
      <SceneWrapper>
        {view === "admin" && <AdminDashboard teams={teams} setTeams={setTeams} eventState={eventState} setEventState={setEventState} />}
        {view === "player" && <PlayerSection globalTeams={teams} setGlobalTeams={setTeams} eventState={eventState} />}
      </SceneWrapper>
    </>
  );
}