(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let settings;

  const say = (t) => { $("status").textContent = t; };

  function currentProfile() { return settings.profiles.find((p) => p.id === $("profile").value); }

  function readProfile() {
    const p = currentProfile();
    if (!p) return;
    p.name = $("pname").value.trim() || p.name;
    p.prompt = $("pprompt").value;
    p.style = $("pstyle").value;
    p.avoid = $("pavoid").value;
    p.minWords = Math.max(1, Number($("pmin").value) || 1);
    p.maxWords = Math.max(p.minWords, Number($("pmax").value) || p.minWords);
    p.questions = $("pq").value;
    p.emojis = $("pemoji").checked;
  }

  function fillProfile() {
    const p = currentProfile();
    if (!p) return;
    $("pname").value = p.name; $("pprompt").value = p.prompt; $("pstyle").value = p.style;
    $("pavoid").value = p.avoid; $("pmin").value = p.minWords; $("pmax").value = p.maxWords;
    $("pq").value = p.questions; $("pemoji").checked = !!p.emojis;
  }

  function renderProfiles(selectId) {
    $("profile").innerHTML = "";
    settings.profiles.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id; o.textContent = p.name;
      $("profile").appendChild(o);
    });
    $("profile").value = selectId || settings.activeProfileId;
    fillProfile();
  }

  function readOllama() {
    return {
      apiType: $("apiType").value,
      baseUrl: $("baseUrl").value.trim() || "http://localhost:11434",
      model: $("model").value.trim(),
      temperature: Number($("temperature").value),
      maxTokens: Number($("maxTokens").value)
    };
  }

  async function load() {
    const { settings: stored } = await chrome.storage.local.get("settings");
    settings = OXR.mergeSettings(stored);
    const o = settings.ollama;
    $("apiType").value = o.apiType || "ollama"; $("baseUrl").value = o.baseUrl; $("model").value = o.model;
    $("temperature").value = o.temperature; $("maxTokens").value = o.maxTokens;
    $("autoPost").checked = settings.autoPost;
    renderProfiles();
  }

  let shown = null;
  $("profile").addEventListener("focus", () => { shown = $("profile").value; });
  $("profile").addEventListener("change", () => {
    const next = $("profile").value;
    $("profile").value = shown || next;
    readProfile();
    $("profile").value = next;
    fillProfile();
  });

  $("add").addEventListener("click", () => {
    readProfile();
    const base = OXR.clone(settings.profiles[0]);
    base.id = "p" + Date.now(); base.name = "New profile";
    settings.profiles.push(base);
    renderProfiles(base.id);
  });

  $("del").addEventListener("click", () => {
    if (settings.profiles.length < 2) return say("Keep at least one profile.");
    settings.profiles = settings.profiles.filter((p) => p.id !== $("profile").value);
    renderProfiles(settings.profiles[0].id);
  });

  $("refresh").addEventListener("click", async () => {
    say("Loading models…");
    const r = await chrome.runtime.sendMessage({ type: "LIST_MODELS", baseUrl: readOllama().baseUrl, apiType: $("apiType").value });
    if (!r.ok) return say("Could not load models: " + r.error);
    $("models").innerHTML = r.models.map((m) => `<option value="${m.replace(/"/g, "&quot;")}">`).join("");
    say(r.models.length ? `${r.models.length} models found.` : "No models installed. Run: ollama pull llama3.2");
  });

  $("test").addEventListener("click", async () => {
    say("Testing…");
    const r = await chrome.runtime.sendMessage({ type: "TEST", ollama: readOllama() });
    say(r.ok ? "Connected: " + r.text : "Failed: " + r.error);
  });

  $("save").addEventListener("click", async () => {
    readProfile();
    settings.ollama = readOllama();
    settings.autoPost = $("autoPost").checked;
    settings.activeProfileId = $("profile").value;
    await chrome.storage.local.set({ settings });
    say("Saved.");
  });

  load();
})();
