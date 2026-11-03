// ============================================================================
//  LinkAce Tools: Bookmark Button — sidebar.js
//  A production of The Ministry of Digital Affairs
//  https://github.com/PK-Fat/LinkAceTools-BookmarkButton · MIT License
// ============================================================================
//
// The add-link form, shared by both popup mode and sidebar mode.
//
// Lists & Tags are predictive (v2.0.0): when the panel opens, every existing
// list and tag is fetched once from LinkAce and cached. Suggestions are then
// filtered locally on every keystroke — no per-keystroke API calls, no lag.
// The last fetched set is also kept in storage.local, so suggestions are
// available the instant the panel opens, while a fresh copy loads behind it.
//
// Nothing stops you from typing a brand-new name — LinkAce creates any list
// or tag that doesn't exist yet when the link is saved.

const addBtn = document.getElementById("addBtn");
const statusEl = document.getElementById("status");
const settingsLink = document.getElementById("settingsLink");
const listsInput = document.getElementById("listsInput");
const listsSuggestionsEl = document.getElementById("listsSuggestions");
const tagsInput = document.getElementById("tagsInput");
const tagsSuggestionsEl = document.getElementById("tagsSuggestions");

const MAX_SUGGESTIONS = 8;
const CACHE_KEY = "suggestionCache"; // { baseUrl, lists: [], tags: [] }

// In-memory name sets, filled from cache first, then from the API.
const known = { lists: [], tags: [] };

settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

async function getSettings() {
  const { linkaceBaseUrl, linkaceApiToken } = await browser.storage.local.get([
    "linkaceBaseUrl",
    "linkaceApiToken",
  ]);
  return { baseUrl: linkaceBaseUrl || "", apiToken: linkaceApiToken || "" };
}

function parseCommaList(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueSorted(names) {
  const seen = new Map();
  for (const n of names) {
    const name = String(n || "").trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

// ---- Loading existing lists & tags ----

// GET /api/v2/lists and /api/v2/tags are paginated. per_page=0 asks LinkAce
// for everything in one page; we still follow next_page_url in case an
// instance caps page size.
async function fetchAllNames(baseUrl, apiToken, kind) {
  const names = [];
  let url = `${baseUrl}/api/v2/${kind}?per_page=0&order_by=name&order_dir=asc`;
  let guard = 0;

  while (url && guard++ < 50) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok) throw new Error(`${kind}: HTTP ${res.status}`);
    const page = await res.json();
    for (const item of page.data || []) names.push(item.name);
    url = page.next_page_url || null;
  }
  return uniqueSorted(names);
}

async function loadKnownNames() {
  const { baseUrl, apiToken } = await getSettings();
  if (!baseUrl || !apiToken) return;

  // 1. Instant: whatever we fetched last time (only if it's for this instance).
  try {
    const { [CACHE_KEY]: cache } = await browser.storage.local.get(CACHE_KEY);
    if (cache && cache.baseUrl === baseUrl) {
      known.lists = cache.lists || [];
      known.tags = cache.tags || [];
    }
  } catch (e) {
    // No cache yet — fine.
  }

  // 2. Fresh copy from LinkAce.
  try {
    const [lists, tags] = await Promise.all([
      fetchAllNames(baseUrl, apiToken, "lists"),
      fetchAllNames(baseUrl, apiToken, "tags"),
    ]);
    known.lists = lists;
    known.tags = tags;
    await browser.storage.local.set({ [CACHE_KEY]: { baseUrl, lists, tags } });
    // If someone is already typing, refresh what they see.
    for (const ac of autocompletes) if (document.activeElement === ac.input) ac.refresh();
  } catch (e) {
    // Suggestions are best-effort; a failed fetch shouldn't block saving.
  }
}

// Newly-created names should show up as suggestions straight away next time.
async function rememberNames(lists, tags) {
  known.lists = uniqueSorted([...known.lists, ...lists]);
  known.tags = uniqueSorted([...known.tags, ...tags]);
  const { baseUrl } = await getSettings();
  try {
    await browser.storage.local.set({
      [CACHE_KEY]: { baseUrl, lists: known.lists, tags: known.tags },
    });
  } catch (e) {
    // ignore
  }
}

// ---- Predictive autocomplete ----

// Find the comma-separated segment the cursor is in.
function getSegmentBounds(input) {
  const value = input.value;
  const cursor = input.selectionStart ?? value.length;
  const start = value.lastIndexOf(",", cursor - 1) + 1;
  let end = value.indexOf(",", cursor);
  if (end === -1) end = value.length;
  return { start, end, text: value.slice(start, end).trim() };
}

function replaceCurrentSegment(input, replacement) {
  const { start, end } = getSegmentBounds(input);
  const before = input.value.slice(0, start);
  const after = input.value.slice(end).replace(/^\s*,?\s*/, "");
  const lead = before.length ? " " : "";
  const newBefore = `${before}${lead}${replacement}, `;
  input.value = newBefore + after;
  input.setSelectionRange(newBefore.length, newBefore.length);
  input.focus();
}

// Prefix matches first, then word-start matches, then anywhere-in-name.
function rankMatches(names, query, exclude) {
  const q = query.toLowerCase();
  const scored = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    if (exclude.has(lower)) continue;
    if (!q) {
      scored.push([0, name]);
      continue;
    }
    const idx = lower.indexOf(q);
    if (idx === -1) continue;
    let score = 2;
    if (idx === 0) score = 0;
    else if (/[\s\-_/.]/.test(lower[idx - 1])) score = 1;
    scored.push([score, name]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, MAX_SUGGESTIONS).map(([, name]) => name);
}

// Render a name with the matched part bolded (textContent only — no innerHTML
// with user data).
function highlight(name, query) {
  const frag = document.createDocumentFragment();
  const idx = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) {
    frag.append(name);
    return frag;
  }
  const strong = document.createElement("strong");
  strong.textContent = name.slice(idx, idx + query.length);
  frag.append(name.slice(0, idx), strong, name.slice(idx + query.length));
  return frag;
}

function createAutocomplete(input, container, kind) {
  const noun = kind === "lists" ? "list" : "tag";
  let items = [];
  let active = -1;

  function close() {
    container.classList.remove("open");
    container.replaceChildren();
    items = [];
    active = -1;
  }

  function setActive(i) {
    const els = container.querySelectorAll(".suggestion-item");
    els.forEach((el, n) => el.classList.toggle("active", n === i));
    active = i;
    if (els[i]) els[i].scrollIntoView({ block: "nearest" });
  }

  function choose(name) {
    replaceCurrentSegment(input, name);
    refresh(); // keep it open for the next entry
  }

  function refresh() {
    const { text } = getSegmentBounds(input);
    // Don't suggest things already entered in this field (other segments).
    const exclude = new Set(
      parseCommaList(input.value)
        .map((s) => s.toLowerCase())
        .filter((s) => s !== text.toLowerCase())
    );
    items = rankMatches(known[kind], text, exclude);

    container.replaceChildren();
    active = -1;

    items.forEach((name, i) => {
      const el = document.createElement("div");
      el.className = "suggestion-item";
      el.append(highlight(name, text));
      // mousedown (not click) fires before the input's blur hides the list.
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(name);
      });
      el.addEventListener("mouseenter", () => setActive(i));
      container.appendChild(el);
    });

    // Typed something that isn't an existing name? Say it'll be created.
    const exact = known[kind].some((n) => n.toLowerCase() === text.toLowerCase());
    if (text && !exact) {
      const hint = document.createElement("div");
      hint.className = "suggestion-hint";
      hint.textContent = `New ${noun} “${text}” will be created on save`;
      container.appendChild(hint);
    } else if (!items.length && !known[kind].length) {
      const hint = document.createElement("div");
      hint.className = "suggestion-hint";
      hint.textContent = `No existing ${kind} found yet`;
      container.appendChild(hint);
    }

    container.classList.toggle("open", container.childElementCount > 0);
    if (text && items.length) setActive(0);
  }

  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);
  input.addEventListener("click", refresh); // cursor moved to another segment
  input.addEventListener("blur", () => setTimeout(close, 100));

  input.addEventListener("keydown", (e) => {
    const open = container.classList.contains("open") && items.length;
    switch (e.key) {
      case "ArrowDown":
        if (!container.classList.contains("open")) refresh();
        else if (open) setActive((active + 1) % items.length);
        e.preventDefault();
        break;
      case "ArrowUp":
        if (open) setActive(active <= 0 ? items.length - 1 : active - 1);
        e.preventDefault();
        break;
      case "Enter":
        if (open && active >= 0) {
          e.preventDefault();
          choose(items[active]);
        }
        break;
      case "Tab":
        if (open && active >= 0 && !e.shiftKey) {
          e.preventDefault();
          choose(items[active]);
        }
        break;
      case "Escape":
        if (container.classList.contains("open")) {
          e.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  });

  return { input, refresh, close };
}

const autocompletes = [
  createAutocomplete(listsInput, listsSuggestionsEl, "lists"),
  createAutocomplete(tagsInput, tagsSuggestionsEl, "tags"),
];

loadKnownNames();

// Settings changed (new instance or token) → reload suggestions.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.linkaceBaseUrl || changes.linkaceApiToken)) {
    known.lists = [];
    known.tags = [];
    loadKnownNames();
  }
});

// ---- Save current page ----

addBtn.addEventListener("click", async () => {
  setStatus("");
  addBtn.disabled = true;

  try {
    const { baseUrl, apiToken } = await getSettings();
    if (!baseUrl || !apiToken) {
      setStatus("Set your LinkAce URL and API token in options first.", true);
      browser.runtime.openOptionsPage();
      return;
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      throw new Error("Couldn't read the active tab.");
    }

    // about:, moz-extension:, etc. can't be scripted into for selection text.
    let selection = "";
    if (/^https?:/i.test(tab.url)) {
      try {
        const results = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection().toString(),
        });
        selection = (results && results[0] && results[0].result) || "";
      } catch (e) {
        // Selection grab is best-effort; page may block content scripts.
        selection = "";
      }
    }

    const title = tab.title || tab.url;
    const lists = parseCommaList(listsInput.value);
    const tags = parseCommaList(tagsInput.value);

    const response = await fetch(`${baseUrl}/api/v2/links`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        url: tab.url,
        title,
        description: selection,
        lists,
        tags,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      setStatus("LinkAce rejected the API token — check it in options.", true);
      return;
    }

    if (!response.ok) {
      let detail = "";
      try {
        const errBody = await response.json();
        detail = errBody.message || "";
      } catch (e) {
        // response wasn't JSON; ignore
      }
      throw new Error(detail || `LinkAce returned an error (${response.status}).`);
    }

    const saved = await response.json();
    setStatus(`Saved: ${saved.title || title}`);
    await rememberNames(lists, tags);
    listsInput.value = "";
    tagsInput.value = "";
  } catch (err) {
    setStatus(err.message || "Something went wrong.", true);
  } finally {
    addBtn.disabled = false;
  }
});
