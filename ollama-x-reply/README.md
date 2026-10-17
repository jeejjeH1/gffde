# Ollama X Reply

Original MV3 extension that adds an **AI** button to every post on X. It builds a profile-based prompt, asks a local Ollama model for one reply, validates it (word range, no duplicates of the last 25 replies, no leaked instructions, no hashtags when forbidden, one automatic retry with the failure reason), opens the reply composer and inserts the text. Posting is manual unless you enable auto-post in settings.

Install: `chrome://extensions` → Developer mode → Load unpacked → select this folder. Open the extension icon to configure the model and profiles. Requires `ollama serve` and a pulled model (e.g. `ollama pull llama3.2`).

`localhost:11434` requests have their `Origin` header removed via declarativeNetRequest (rules.json) so Ollama accepts them; for another host set `OLLAMA_ORIGINS=chrome-extension://*`.

Not included on purpose: accounts/subscriptions, bulk reply and follow/unfollow automation.
