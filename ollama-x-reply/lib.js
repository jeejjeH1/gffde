(function (root) {
  "use strict";

  const DEFAULTS = {
    ollama: { baseUrl: "http://localhost:11434", model: "llama3.2", temperature: 0.6, maxTokens: 120 },
    activeProfileId: "main",
    autoPost: false,
    profiles: [
      {
        id: "main",
        name: "Main",
        prompt: "You are a genuine participant in crypto and NFT Twitter. Reply directly to the post with a natural, relevant thought.",
        style: "Casual, concise and conversational. Sound like a person, not an assistant. Use simple English.",
        avoid: "No hashtags. No quotation marks. No sales language. No generic praise. Do not summarize the post.",
        minWords: 3,
        maxWords: 18,
        emojis: false,
        questions: "occasionally"
      },
      {
        id: "friendly",
        name: "Friendly",
        prompt: "Respond like a warm mutual who understands the topic and wants to continue the conversation.",
        style: "Friendly, relaxed, specific and short.",
        avoid: "No hashtags. No corporate phrasing. Avoid empty compliments.",
        minWords: 4,
        maxWords: 20,
        emojis: true,
        questions: "occasionally"
      },
      {
        id: "degen",
        name: "Degen",
        prompt: "Reply as an experienced crypto Twitter degen who understands the culture.",
        style: "Very casual, punchy, lower-case when natural, light slang.",
        avoid: "No hashtags. No financial advice. No fake certainty.",
        minWords: 2,
        maxWords: 12,
        emojis: false,
        questions: "rarely"
      }
    ],
    history: []
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function mergeSettings(stored) {
    const s = clone(DEFAULTS);
    if (!stored) return s;
    Object.assign(s.ollama, stored.ollama || {});
    if (Array.isArray(stored.profiles) && stored.profiles.length) s.profiles = stored.profiles;
    if (stored.activeProfileId) s.activeProfileId = stored.activeProfileId;
    if (typeof stored.autoPost === "boolean") s.autoPost = stored.autoPost;
    if (Array.isArray(stored.history)) s.history = stored.history;
    return s;
  }

  function normalizeSpace(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
  function wordCount(v) { const t = normalizeSpace(v); return t ? t.split(" ").length : 0; }

  function getProfile(settings, id) {
    return settings.profiles.find((p) => p.id === (id || settings.activeProfileId)) || settings.profiles[0];
  }

  function buildPrompt(profile, ctx) {
    const thread = (ctx.thread || []).filter(Boolean)
      .map((t, i) => `Thread ${i + 1}: ${normalizeSpace(t)}`).join("\n");
    const author = [ctx.author && ctx.author.name, ctx.author && ctx.author.handle ? "@" + ctx.author.handle : ""]
      .filter(Boolean).join(" ");
    return [
      "Write exactly one reply to the X post below.",
      `Identity: ${profile.prompt}`,
      `Style: ${profile.style}`,
      `Avoid: ${profile.avoid}`,
      `Length: ${profile.minWords}-${profile.maxWords} words.`,
      `Emoji policy: ${profile.emojis ? "A natural emoji is allowed but not required." : "Do not use emojis."}`,
      `Question policy: ${profile.questions || "occasionally"}.`,
      author ? `The post was written by ${author}.` : "",
      "Return only the reply text, with no label, explanation, or quotation marks.",
      thread ? `Conversation context:\n${thread}` : "",
      `Post to reply to: ${normalizeSpace(ctx.text)}`
    ].filter(Boolean).join("\n\n");
  }

  function sanitizeReply(raw) {
    let t = normalizeSpace(String(raw || "").replace(/<think>[\s\S]*?<\/think>/gi, ""));
    const unquote = (x) => ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("“") && x.endsWith("”"))) && x.length > 1 ? x.slice(1, -1).trim() : x;
    t = unquote(t).replace(/^(reply|response)\s*:\s*/i, "");
    return unquote(t);
  }

  function validateReply(raw, profile, recent) {
    const text = sanitizeReply(raw);
    const n = wordCount(text);
    const seen = (recent || []).map((r) => normalizeSpace(r).toLowerCase());
    if (!text) return { ok: false, reason: "The reply was empty.", text };
    if (n < profile.minWords) return { ok: false, reason: `Reply is shorter than ${profile.minWords} words.`, text };
    if (n > profile.maxWords) return { ok: false, reason: `Reply is longer than ${profile.maxWords} words.`, text };
    if (seen.includes(text.toLowerCase())) return { ok: false, reason: "Reply duplicates a recent reply.", text };
    if (/\b(as an ai|language model|system prompt|instructions above)\b/i.test(text)) return { ok: false, reason: "Reply leaked AI instructions.", text };
    if (/#\w+/.test(text) && /no hashtags/i.test(profile.avoid || "")) return { ok: false, reason: "Reply contains a forbidden hashtag.", text };
    return { ok: true, reason: "", text };
  }

  root.OXR = { DEFAULTS, mergeSettings, normalizeSpace, getProfile, buildPrompt, sanitizeReply, validateReply, clone };
})(typeof self !== "undefined" ? self : this);
