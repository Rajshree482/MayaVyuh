

import { useState, useEffect, useRef, useCallback } from "react";

const CHANNEL_NAME = "mayavyuh_sync";
let _bc = null;
function getBroadcastChannel() {
  if (!_bc) {
    try { _bc = new BroadcastChannel(CHANNEL_NAME); } catch (e) { _bc = null; }
  }
  return _bc;
}

export function useSyncState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === key && e.newValue) {
        try { setValue(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);
  useEffect(() => {
    const bc = getBroadcastChannel();
    if (!bc) return;
    const handler = (e) => {
      if (e.data?.key === key) {
        try { setValue(e.data.value); } catch {}
      }
    };
    bc.addEventListener("message", handler);
    return () => bc.removeEventListener("message", handler);
  }, [key]);

  const setValueAndBroadcast = useCallback((updater) => {
    setValue(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { window.localStorage.setItem(key, JSON.stringify(next)); } catch {}
      const bc = getBroadcastChannel();
      if (bc) bc.postMessage({ key, value: next });
      return next;
    });
  }, [key]);

  return [value, setValueAndBroadcast];
}


export function broadcastEvent(eventType, payload = {}) {
  const bc = getBroadcastChannel();
  if (bc) bc.postMessage({ _event: true, eventType, payload, ts: Date.now() });
  window.dispatchEvent(new CustomEvent("maya_event", { detail: { eventType, payload } }));
}


export function useEventListener(handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const bc = getBroadcastChannel();
    const bcHandler = (e) => {
      if (e.data?._event) handlerRef.current(e.data.eventType, e.data.payload);
    };
    const windowHandler = (e) => {
      handlerRef.current(e.detail.eventType, e.detail.payload);
    };
    if (bc) bc.addEventListener("message", bcHandler);
    window.addEventListener("maya_event", windowHandler);
    return () => {
      if (bc) bc.removeEventListener("message", bcHandler);
      window.removeEventListener("maya_event", windowHandler);
    };
  }, []);
}

export { useState, useEffect, useRef, useCallback };