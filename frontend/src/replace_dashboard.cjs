const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'AdminComponents.jsx');
let code = fs.readFileSync(filePath, 'utf-8');

const regex = /const ImageBankModal = [\s\S]*/;

const replacement = `const MayaNexusNav = ({ active, setActive }) => {
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
      const res = await fetch("http://localhost:5001/api/admin/images");
      const data = await res.json();
      setImages(data);
    } catch(err) { console.error(err); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const uploadRes = await fetch("http://localhost:5001/api/upload", { method: "POST", body: formData });
      const { url } = await uploadRes.json();
      await fetch("http://localhost:5001/api/admin/images", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://localhost:5001" + url }),
      });
      fetchImages();
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(\`http://localhost:5001/api/admin/images/\${id}\`, { method: 'DELETE' });
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
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} disabled={loading} />
          </label>
        </div>
      </div>
      
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 32, paddingRight: 16 }}>
        {images.map((img, i) => (
          <div key={img._id} style={{ position: "relative", height: 250, border: "1px solid rgba(212, 175, 55, 0.2)", borderRadius: 8, overflow: "hidden", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.9)", padding: "4px 12px", border: "1px solid rgba(212, 175, 55, 0.4)", color: "#D4AF37", fontSize: 10, letterSpacing: 2, zIndex: 10 }}>
              ARTIFACT_{String(i + 1).padStart(2, '0')}
            </div>
            <button onClick={() => handleDelete(img._id)} className="btn-imperial-danger" style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 16, zIndex: 10 }}>×</button>
            <img src={img.url} alt={\`Artifact \${i}\`} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8, transition: "opacity 0.3s" }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.8} />
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

  const fetchSession = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/game/status');
      const data = await res.json();
      if (data.session) setSession(data.session);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchSession();
    const interval = setInterval(() => { if (isAuthenticated) fetchSession(); }, 5000);
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
      await fetch('http://localhost:5001/api/game/start', {
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
    setTeams([]);
    gameAction('reset');
    setEventState({ started: false, phase: "lobby" });
  };

  const seedDatabase = () => alert("IMPERIAL PROTOCOL: SEED_DB triggered!");

  const sortedTeams = [...teams].filter(t => t.score !== undefined && t.score !== null).sort((a,b) => b.score - a.score);
  const status = session?.status || 'waiting';
  const fmtTime = (s) => \`\${Math.floor(s/60)}:\${String(s%60).padStart(2,'0')}\`;
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
                  const isActive = status === \`round\${r}_active\`;
                  const isEnded = status === \`round\${r}_ended\`;
                  const isIdle = !status || status === 'waiting' || status === 'lobby' || status === 'finished';
                  const canStart = (isIdle && r === 1) || status === \`round\${r-1}_ended\` || status === \`round\${r}_ended\`;
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
                    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, color: i === 0 ? "#D4AF37" : "#fff" }}>{t.score}</div>
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
                    <button className={t.status === "banned" ? "btn-imperial" : "btn-imperial-danger"} style={{ padding: "12px", fontSize: 10, letterSpacing: 2, marginTop: 8 }} onClick={() => toggleBan(t.id)}>
                      {t.status === "banned" ? "RESTORE TO GLORY" : "BANISH FROM DATACRON"}
                    </button>
                  </div>
                ))}
                {teams.length === 0 && <div style={{ color: "#718096", textAlign: "center", padding: 40, letterSpacing: 2, fontSize: 12 }}>ROSTER EMPTY</div>}
              </div>
            </div>
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
\n`;

const newCode = code.replace(regex, replacement);
fs.writeFileSync(filePath, newCode, 'utf-8');
console.log('Successfully replaced AdminComponents.jsx');
