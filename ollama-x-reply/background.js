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

const base = (u) => String(u || "").replace(/\/+$/, "");

async function ollamaChat(cfg, prompt, maxTokens) {
  let res;
  try {
    res = await fetch(`${base(cfg.baseUrl)}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        messages: [{ role: "user", content: prompt }],
        options: { temperature: Number(cfg.temperature), num_predict: Number(maxTokens || cfg.maxTokens) }
      })
    });
  } catch (_) {
    throw new Error("Cannot reach Ollama. Is it running at " + cfg.baseUrl + "?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403) throw new Error("Ollama rejected the request (403). Set OLLAMA_ORIGINS=chrome-extension://* and restart Ollama.");
    throw new Error(data.error || `Ollama returned HTTP ${res.status}.`);
  }
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

async function listModels(baseUrl) {
  const res = await fetch(`${base(baseUrl)}/api/tags`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const run = async () => {
    if (msg.type === "GENERATE") return generate(msg.payload);
    if (msg.type === "TEST") {
      const s = await loadSettings();
      const cfg = Object.assign({}, s.ollama, msg.ollama || {});
      return { text: OXR.sanitizeReply(await ollamaChat(cfg, "Reply with only the word: connected", 12)) };
    }
    if (msg.type === "LIST_MODELS") return { models: await listModels(msg.baseUrl) };
    throw new Error("Unknown message");
  };
  run().then((r) => respond({ ok: true, ...r })).catch((e) => respond({ ok: false, error: e.message }));
  return true;
});
