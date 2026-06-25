# MayaVyuh: The Prompt War — v2.0
## Complete Deployment Guide & Architecture

---

## 📁 File Structure (what to copy where)

```
MayaVyuh-main/
├── index.html                  ← Replace existing
├── package.json                ← Replace existing
├── vite.config.js              ← Replace existing
└── src/
    ├── App.jsx                 ← Replace existing (Player flows + Root App)
    ├── App.css                 ← Replace existing
    ├── index.css               ← Replace existing
    ├── main.jsx                ← Replace existing (unchanged but clean)
    ├── useSync.js              ← NEW — create this file
    ├── AdminComponents.jsx     ← NEW — create this file
    └── assets/
        ├── bg-1.jpg            ← Your existing background images (keep all)
        ├── bg-2.jpg
        ├── bg-3.jpg
        ├── bg-4.jpg
        └── bg-5.jpg
```

---

## 🚀 Step-by-Step Deployment

### 1. Copy the files
Replace/create each file exactly as listed above.
The two NEW files (`useSync.js`, `AdminComponents.jsx`) go directly inside `src/`.

### 2. Install dependencies (if you haven't already)
```bash
cd MayaVyuh-main
npm install
```

### 3. Run locally to test
```bash
npm run dev
```
Open two browser tabs:
- Tab 1 (Admin): `http://localhost:5173/MayaVyuh/#admin`
- Tab 2 (Player): `http://localhost:5173/MayaVyuh/#player`

### 4. Deploy to GitHub Pages
```bash
npm run deploy
```
This runs `npm run build` then pushes the `dist/` folder to the `gh-pages` branch.

Live URL: `https://rajshree482.github.io/MayaVyuh/`

---

## 🗺️ URL Routing (Hash-based, works on GitHub Pages)

| URL Hash | View |
|---|---|
| (none / `#`) | Landing Page — choose Admin or Player |
| `#admin` | Admin Command Center |
| `#player` | Player Portal — registration & game |

GitHub Pages doesn't support server-side routing, so hash routing is used.
No 404 issues, no `.htaccess` needed.

---

## 🔄 How Cross-Tab Sync Works (localStorage + BroadcastChannel)

```
Admin Tab                          Player Tab
─────────                          ──────────
Approves team          →  BroadcastChannel  →  Player receives TEAM_APPROVED
                                               Player enters Round 1

Player types spell     →  localStorage     →  Admin sees live text in Roster
                          (every keystroke)

Admin casts penalty    →  BroadcastChannel  →  Player sees glitch overlay + toast

Admin declares winners →  localStorage     →  Player's waiting lobby → Victory Screen
```

**Same-device, same-browser only.** For multi-device events, replace `useSync.js`.

---

## 🔌 Swapping to Django + MongoDB Backend (for your team)

When you're ready to go multi-device, your team only needs to change **one file**: `useSync.js`.

### Django Channels WebSocket replacement:

```javascript
// useSync.js — Django Channels version (replace the localStorage version)
import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = "ws://your-django-server.com/ws/maya/";
let _ws = null;
const _listeners = new Map();

function getWS() {
  if (!_ws || _ws.readyState > 1) {
    _ws = new WebSocket(WS_URL);
    _ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.key) _listeners.get(data.key)?.forEach(fn => fn(data.value));
      if (data._event) _listeners.get("__event__")?.forEach(fn => fn(data.eventType, data.payload));
    };
  }
  return _ws;
}

export function useSyncState(key, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const ws = getWS();
    // Ask server for current value on mount
    ws.send(JSON.stringify({ action: "get", key }));

    const handler = (v) => setValue(v);
    if (!_listeners.has(key)) _listeners.set(key, new Set());
    _listeners.get(key).add(handler);
    return () => _listeners.get(key).delete(handler);
  }, [key]);

  const setValueAndBroadcast = useCallback((updater) => {
    setValue(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      getWS().send(JSON.stringify({ action: "set", key, value: next }));
      return next;
    });
  }, [key]);

  return [value, setValueAndBroadcast];
}

export function broadcastEvent(eventType, payload = {}) {
  getWS().send(JSON.stringify({ action: "event", eventType, payload }));
}

export function useEventListener(handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const fn = (et, p) => handlerRef.current(et, p);
    if (!_listeners.has("__event__")) _listeners.set("__event__", new Set());
    _listeners.get("__event__").add(fn);
    return () => _listeners.get("__event__").delete(fn);
  }, []);
}
```

### Django side (Python/channels):
```python
# consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import GameState  # Your MongoDB model via djongo or motor

class MayaConsumer(AsyncWebsocketConsumer):
    group = "maya_game"

    async def connect(self):
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def receive(self, text_data):
        data = json.loads(text_data)
        
        if data["action"] == "set":
            # Save to MongoDB
            await GameState.objects.aupdate_or_create(
                key=data["key"], defaults={"value": data["value"]}
            )
            # Broadcast to all tabs
            await self.channel_layer.group_send(self.group, {
                "type": "sync.message",
                "key": data["key"],
                "value": data["value"]
            })
        
        elif data["action"] == "get":
            obj = await GameState.objects.aget(key=data["key"])
            await self.send(json.dumps({"key": data["key"], "value": obj.value}))
        
        elif data["action"] == "event":
            await self.channel_layer.group_send(self.group, {
                "type": "sync.event",
                "_event": True,
                "eventType": data["eventType"],
                "payload": data["payload"]
            })

    async def sync_message(self, event):
        await self.send(json.dumps({"key": event["key"], "value": event["value"]}))

    async def sync_event(self, event):
        await self.send(json.dumps(event))
```

### MongoDB model (djongo):
```python
# models.py
from djongo import models
import json

class GameState(models.Model):
    key   = models.CharField(max_length=100, unique=True)
    value = models.TextField()  # JSON-serialised
    
    class Meta:
        db_table = "mayavyuh_state"
```

---

## 🎮 Complete Game Flow (11 Steps)

```
Step 1:  Players open /MayaVyuh/#player → Registration form (team name, 2 players, role)
Step 2:  Team appears in Admin Roster as PENDING 🟡
Step 3:  Admin clicks APPROVE → Player tab unlocks
Step 4:  Observer → Round 1 GeminiUI (target image visible, forbidden words active)
         Creator → Waiting Lobby (Oracle's Lock game + live observer text preview)
Step 5:  Round 1 ends (timer or Submit) → Discussion Interval (2 min, verbal only)
Step 6:  Creator → Round 2 GeminiUI (Round 1 image as reference)
         Observer → Waiting Lobby
Step 7:  Round 2 ends → Swap Interval (1 min, silent)
Step 8:  Player selects base image (Round 1 or Round 2 output)
Step 9:  Observer → Round 3 GeminiUI (selected base as reference, final refinement)
Step 10: Team selects final submission from all 3 round outputs
Step 11: AI similarity score displayed → Return to Waiting Lobby
         Admin declares winners → All waiting lobbies show Victory Screen
```

---

## 👑 Admin Panel Reference

| Panel | What it does |
|---|---|
| Arsenal & Spell Book | Upload target image, manage forbidden lexicon, set round timers |
| The Roster | See all teams (PENDING/ACTIVE/PENALIZED/BANNED), approve teams, live spectator feed |
| Disciplinary Suite | Select team → cast penalty (−30s) or ban |
| Hall of Champions | Live leaderboard + declare winners |
| Activity Oracle | Full event log |
| Security Alerts | Anti-cheat violations (tab switch, devtools, etc.) |
| Oracle Config | Auto-disqualify settings |

---

## 🔐 Anti-Cheat Events

The following trigger alerts in the Admin panel and potentially disqualify:

| Trigger | How it's detected |
|---|---|
| Tab switch | `document.visibilitychange` |
| Window blur | `window.blur` event |
| Page leave | `beforeunload` event |
| Ctrl+T / Ctrl+N / Ctrl+W | `keydown` intercept |
| F12 / Ctrl+Shift+I | `keydown` intercept |
| Right click | `contextmenu` intercept |

**Policy:** 1st offense = warning toast. 2nd offense = auto-disqualification screen.
Admin can adjust this in Oracle Config.

---

## 🎨 Background Images

The 5 images in `src/assets/` (bg-1.jpg → bg-5.jpg) rotate as parallax backgrounds
with a 14-second crossfade interval. They're filtered with `sepia(0.4) brightness(0.55)`
to maintain the dark ancient aesthetic regardless of their original colours.

To add more images:
1. Add `bg-6.jpg` to `src/assets/`
2. In `AdminComponents.jsx`, add `import bg6 from "./assets/bg-6.jpg"` and add `bg6` to `BG_IMAGES`

---

## 🛠️ Removing Dev Controls for Production

Before the final event, remove the `[DEV] NEXT →` and `[DEV] PENALTY` buttons.
In `App.jsx`, find and delete this block near the bottom of `PlayerSection`:

```jsx
{/* Dev controls */}
{isActive&&(
  <div style={{ ... }}>
    <button ... onClick={...}>[DEV] NEXT →</button>
    <button ... onClick={...}>[DEV] PENALTY</button>
  </div>
)}
```

---

## ❓ Common Issues

**"Team approved but player tab doesn't update"**
→ Both tabs must be in the same browser on the same machine (localStorage limitation).
→ Fix: implement the Django Channels backend above.

**"Background images not loading"**
→ Make sure `bg-1.jpg` through `bg-5.jpg` exist in `src/assets/`.
→ Filenames are case-sensitive. Check exactly.

**"Build succeeds but site shows blank on GitHub Pages"**
→ Verify `base: '/MayaVyuh/'` in `vite.config.js` matches your repo name exactly.

**"Fonts look wrong / not loading"**
→ The Google Fonts import in `GlobalStyles` requires internet. Works on deployment.
→ For offline events, download the fonts and serve them locally.

**"npm run deploy fails"**
→ Make sure `gh-pages` is in devDependencies: `npm install gh-pages --save-dev`
→ Ensure your repo has a `gh-pages` branch, or run `git branch gh-pages` first.