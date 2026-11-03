// ============================================================================
//  LinkAce Tools: Bookmark Button — options.js
//  A production of The Ministry of Digital Affairs
//  https://github.com/PK-Fat/LinkAceTools-BookmarkButton · MIT License
// ============================================================================
//
// Settings page — instance URL, API token, and toolbar/sidebar mode.
// (Saving a new URL/token makes the form re-fetch its list/tag suggestions.)

const baseUrlInput = document.getElementById("baseUrl");
const apiTokenInput = document.getElementById("apiToken");
const toggleTokenBtn = document.getElementById("toggleToken");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const modeRadios = document.querySelectorAll('input[name="uiMode"]');

const DEFAULT_MODE = "sidebar";

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!url) return "";
  // Strip trailing slashes for consistent concatenation later.
  url = url.replace(/\/+$/, "");
  return url;
}

toggleTokenBtn.addEventListener("click", () => {
  const isPassword = apiTokenInput.type === "password";
  apiTokenInput.type = isPassword ? "text" : "password";
  toggleTokenBtn.textContent = isPassword ? "Hide" : "Show";
});

async function load() {
  try {
    // Stored in local (device-only) storage, not sync — a token shouldn't
    // travel through Firefox Sync servers.
    const { linkaceBaseUrl, linkaceApiToken, uiMode = DEFAULT_MODE } = await browser.storage.local.get([
      "linkaceBaseUrl",
      "linkaceApiToken",
      "uiMode",
    ]);
    if (linkaceBaseUrl) baseUrlInput.value = linkaceBaseUrl;
    if (linkaceApiToken) apiTokenInput.value = linkaceApiToken;
    for (const r of modeRadios) r.checked = r.value === uiMode;
  } catch (e) {
    setStatus("Couldn't load saved settings.", true);
  }
}

for (const r of modeRadios) {
  r.addEventListener("change", async () => {
    if (!r.checked) return;
    await browser.storage.local.set({ uiMode: r.value });
    // The sidebar can stay open on its own (toggled manually via Firefox's
    // sidebar picker, separate from the toolbar button) — so switching to
    // popup mode should also close it if it's currently open, rather than
    // leaving a stale panel sitting there.
    if (r.value === "popup") {
      const isOpen = await browser.sidebarAction.isOpen({});
      if (isOpen) await browser.sidebarAction.close();
    }
  });
}

saveBtn.addEventListener("click", async () => {
  const url = normalizeUrl(baseUrlInput.value);
  const token = apiTokenInput.value.trim();

  if (!url) {
    setStatus("Enter a LinkAce instance URL first.", true);
    return;
  }

  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (e) {
    setStatus("That doesn't look like a valid URL.", true);
    return;
  }

  if (!/^https:\/\//i.test(url)) {
    setStatus("Use an https:// URL for your instance.", true);
    return;
  }

  if (!token) {
    setStatus("Enter your API token too.", true);
    return;
  }

  try {
    await browser.storage.local.set({
      linkaceBaseUrl: url,
      linkaceApiToken: token,
    });
    baseUrlInput.value = url;
    setStatus("Saved.");
  } catch (e) {
    setStatus("Couldn't save settings.", true);
  }
});

load();
