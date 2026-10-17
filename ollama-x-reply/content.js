(function () {
  "use strict";

  const ARTICLE = 'article[data-testid="tweet"]';
  const EDITOR = '[data-testid="tweetTextarea_0"][contenteditable="true"], div[contenteditable="true"][role="textbox"]';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function toast(text, error) {
    const el = document.createElement("div");
    el.className = "oxr-toast" + (error ? " error" : "");
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), error ? 6000 : 2500);
  }

  const own = (article, sel) => Array.from(article.querySelectorAll(sel)).filter((n) => n.closest(ARTICLE) === article);

  function tweetText(article) {
    return OXR.normalizeSpace(own(article, '[data-testid="tweetText"]').map((n) => n.innerText).join(" "));
  }

  function author(article) {
    const box = article.querySelector('[data-testid="User-Name"]');
    if (!box) return { name: "", handle: "" };
    const spans = Array.from(box.querySelectorAll("span")).map((s) => s.textContent.trim());
    const handle = (spans.find((t) => /^@[a-z0-9_]{1,15}$/i.test(t)) || "").slice(1).toLowerCase();
    const name = spans.find((t) => t && !t.startsWith("@") && t !== "·" && !/^\d+[smhd]$/i.test(t)) || "";
    return { name, handle };
  }

  // On a status page, earlier tweets in the column are the conversation so far.
  function threadBefore(article) {
    if (!/\/status\/\d+/.test(location.pathname)) return [];
    const all = Array.from(document.querySelectorAll(ARTICLE));
    return all.slice(0, all.indexOf(article)).map(tweetText).filter(Boolean).slice(-3);
  }

  function visibleEditors() {
    return Array.from(document.querySelectorAll(EDITOR)).filter((n) => n.getClientRects().length);
  }

  async function openComposer(article) {
    const before = new Set(visibleEditors());
    const reply = article.querySelector('[data-testid="reply"]');
    if (!reply) throw new Error("Reply button not found.");
    reply.click();
    for (let i = 0; i < 40; i++) {
      const fresh = visibleEditors().filter((e) => !before.has(e));
      if (fresh.length) return fresh[fresh.length - 1];
      if (i >= 8 && visibleEditors().length) return visibleEditors().pop();
      await sleep(100);
    }
    throw new Error("Reply composer did not open.");
  }

  function insertText(editor, text) {
    editor.focus();
    document.execCommand("selectAll", false);
    if (document.execCommand("insertText", false, text)) return;
    const data = new DataTransfer();
    data.setData("text/plain", text);
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }

  async function clickPost(editor) {
    const scope = editor.closest('[role="dialog"]') || editor.closest("form") || document;
    for (let i = 0; i < 20; i++) {
      const b = scope.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      if (b && b.getAttribute("aria-disabled") !== "true" && !b.disabled) { b.click(); return; }
      await sleep(150);
    }
  }

  async function onClick(article, button) {
    const text = tweetText(article);
    if (!text) return toast("This post has no text to reply to.", true);
    button.disabled = true;
    button.textContent = "…";
    try {
      const res = await chrome.runtime.sendMessage({
        type: "GENERATE",
        payload: { context: { text, author: author(article), thread: threadBefore(article) } }
      });
      if (!res || !res.ok) throw new Error(res ? res.error : "No response from extension.");
      const editor = await openComposer(article);
      insertText(editor, res.text);
      if (res.autoPost) await clickPost(editor);
    } catch (e) {
      toast(e.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "AI";
    }
  }

  function decorate(article) {
    if (article.dataset.oxr) return;
    const group = Array.from(article.querySelectorAll('[role="group"]'))
      .find((g) => g.querySelector('[data-testid="reply"]') && g.closest(ARTICLE) === article);
    if (!group) return;
    article.dataset.oxr = "1";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "oxr-btn";
    b.title = "Generate reply with Ollama";
    b.textContent = "AI";
    b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); onClick(article, b); });
    group.appendChild(b);
  }

  const scan = () => document.querySelectorAll(ARTICLE).forEach(decorate);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
