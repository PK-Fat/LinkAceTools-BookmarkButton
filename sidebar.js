const addBtn = document.getElementById("addBtn");
const statusEl = document.getElementById("status");
const settingsLink = document.getElementById("settingsLink");
const listsInput = document.getElementById("listsInput");
const listsSuggestionsEl = document.getElementById("listsSuggestions");
const tagsInput = document.getElementById("tagsInput");
const tagsSuggestionsEl = document.getElementById("tagsSuggestions");

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

// ---- Lists/Tags autocomplete ----
// Both fields are plain comma-separated text. Typing triggers a debounced
// search against LinkAce's existing lists/tags for suggestions, but nothing
// stops you from typing a brand-new name — LinkAce creates lists/tags that
// don't exist yet automatically when the link is saved.

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function getCurrentSegment(input) {
  const cursor = input.selectionStart ?? input.value.length;
  const upToCursor = input.value.slice(0, cursor);
  const parts = upToCursor.split(",");
  return parts[parts.length - 1].trim();
}

function replaceCurrentSegment(input, replacement) {
  const cursor = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, cursor);
  const after = input.value.slice(cursor);
  const lastCommaIdx = before.lastIndexOf(",");
  const prefix = lastCommaIdx === -1 ? "" : before.slice(0, lastCommaIdx + 1) + " ";
  const newBefore = `${prefix}${replacement}, `;
  input.value = newBefore + after.replace(/^\s*,?\s*/, "");
  const newCursor = newBefore.length;
  input.setSelectionRange(newCursor, newCursor);
  input.focus();
}

async function searchEntities(kind, query) {
  const { baseUrl, apiToken } = await getSettings();
  if (!baseUrl || !apiToken || !query) return {};
  try {
    const url = `${baseUrl}/api/v2/${kind}/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    // Suggestions are best-effort; a failed lookup shouldn't block typing.
    return {};
  }
}

function renderSuggestions(container, input, results) {
  container.innerHTML = "";
  const names = Object.values(results);

  if (!names.length) {
    container.classList.remove("open");
    return;
  }

  names.slice(0, 8).forEach((name) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = name;
    // mousedown (not click) fires before the input's blur handler hides the list.
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      replaceCurrentSegment(input, name);
      container.classList.remove("open");
    });
    container.appendChild(item);
  });

  container.classList.add("open");
}

function wireAutocomplete(input, container, kind) {
  const runSearch = debounce(async () => {
    const query = getCurrentSegment(input);
    if (!query) {
      container.classList.remove("open");
      return;
    }
    const results = await searchEntities(kind, query);
    renderSuggestions(container, input, results);
  }, 250);

  input.addEventListener("input", runSearch);
  input.addEventListener("focus", runSearch);
  input.addEventListener("blur", () => {
    // Small delay so a suggestion's mousedown still registers before this hides it.
    setTimeout(() => container.classList.remove("open"), 100);
  });
}

wireAutocomplete(listsInput, listsSuggestionsEl, "lists");
wireAutocomplete(tagsInput, tagsSuggestionsEl, "tags");

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
    listsInput.value = "";
    tagsInput.value = "";
  } catch (err) {
    setStatus(err.message || "Something went wrong.", true);
  } finally {
    addBtn.disabled = false;
  }
});
