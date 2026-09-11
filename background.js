// LinkAce Tools: Bookmark Button — background script.
//
// The add-link form (sidebar.html) is shared between two UI modes:
//   1. Sidebar mode (default — matches this extension's original,
//      pre-1.5.0 behavior): clicking the toolbar icon opens the sidebar
//      panel.
//   2. Popup mode: clicking the toolbar icon opens the exact same form
//      as a dropdown popup instead, no sidebar involved.
// Which mode is active lives in browser.storage.local under "uiMode", set
// from the options page.
//
// We can't declare a static "default_popup" in the manifest for this,
// since a static popup swallows the onClicked event entirely and there'd
// be no way to fall back to opening the sidebar. So the popup is set
// dynamically instead, based on stored preference.

const DEFAULT_MODE = "sidebar"; // "sidebar" | "popup" — must match options.js

async function applyUiMode() {
  const { uiMode = DEFAULT_MODE } = await browser.storage.local.get("uiMode");
  await browser.action.setPopup({ popup: uiMode === "popup" ? "sidebar.html" : "" });
}

// Only fires when no popup is set (i.e. sidebar mode) — in popup mode the
// browser opens the popup itself and this listener never runs.
browser.action.onClicked.addListener(async () => {
  await browser.sidebarAction.open();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.uiMode) applyUiMode();
});

browser.runtime.onInstalled.addListener(applyUiMode);
browser.runtime.onStartup.addListener(applyUiMode);
applyUiMode();
