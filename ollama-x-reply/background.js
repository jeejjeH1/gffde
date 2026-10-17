"use strict";
importScripts("lib.js");

const get = (k) => new Promise((r) => chrome.storage.local.get(k, r));
const set = (v) => new Promise((r) => chrome.storage.local.set(v, r));

async function loadSettings() {
  const { settings } = await get("settings");
  return OXR.mergeSettings(settings);
}

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await get("settings");
  if (!settings) await set({ settings: OXR.mergeSettings(null) });
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

const base = (u) => String(u || "").replace(/\/+$/, "").replace(/\/v1$/, "");

async function ollamaChat(cfg, prompt, maxTokens) {
  const openai = cfg.apiType === "openai";
  const tokens = Number(maxTokens || cfg.maxTokens);
  const messages = [{ role: "user", content: prompt }];
  let res;
  try {
    res = await fetch(`${base(cfg.baseUrl)}${openai ? "/v1/chat/completions" : "/api/chat"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(openai
        ? { model: cfg.model || "local", stream: false, messages, temperature: Number(cfg.temperature), max_tokens: tokens }
        : { model: cfg.model, stream: false, messages, options: { temperature: Number(cfg.temperature), num_predict: tokens } })
    });
  } catch (_) {
    throw new Error("Cannot reach Ollama at " + cfg.baseUrl + ". On a phone, localhost is the phone itself: use your computer's LAN IP (e.g. http://192.168.1.20:11434) and start Ollama with OLLAMA_HOST=0.0.0.0.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403) throw new Error("Ollama rejected the request (403). Set OLLAMA_ORIGINS=chrome-extension://* and restart Ollama.");
    const detail = data.error && (data.error.message || data.error);
    throw new Error(detail || `Server returned HTTP ${res.status}.`);
  }
  if (openai) return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "";
  return data.message && data.message.content || "";
}

async function generate(payload) {
  const s = await loadSettings();
  const profile = OXR.getProfile(s, payload.profileId);
  const prompt = OXR.buildPrompt(profile, payload.context || {});
  const recent = s.history.slice(0, 25).map((h) => h.reply);

  let raw = await ollamaChat(s.ollama, prompt);
  let v = OXR.validateReply(raw, profile, recent);
  if (!v.ok) {
    raw = await ollamaChat(s.ollama, `${prompt}\n\nYour previous attempt was invalid: ${v.reason} Return a corrected reply only.`);
    v = OXR.validateReply(raw, profile, recent);
  }
  if (!v.ok) throw new Error(v.reason);

  s.history.unshift({ reply: v.text, source: OXR.normalizeSpace(payload.context.text).slice(0, 140), at: Date.now() });
  s.history = s.history.slice(0, 50);
  await set({ settings: s });
  return { text: v.text, autoPost: s.autoPost };
}

async function listModels(baseUrl, apiType) {
  const openai = apiType === "openai";
  const res = await fetch(`${base(baseUrl)}${openai ? "/v1/models" : "/api/tags"}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return openai ? (data.data || []).map((m) => m.id) : (data.models || []).map((m) => m.name);
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const run = async () => {
    if (msg.type === "GENERATE") return generate(msg.payload);
    if (msg.type === "TEST") {
      const s = await loadSettings();
      const cfg = Object.assign({}, s.ollama, msg.ollama || {});
      return { text: OXR.sanitizeReply(await ollamaChat(cfg, "Reply with only the word: connected", 12)) };
    }
    if (msg.type === "LIST_MODELS") return { models: await listModels(msg.baseUrl, msg.apiType) };
    throw new Error("Unknown message");
  };
  run().then((r) => respond({ ok: true, ...r })).catch((e) => respond({ ok: false, error: e.message }));
  return true;
});
