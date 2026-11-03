# LinkAce Tools: Bookmark Button

*A production of The Ministry of Digital Affairs*

A one-click "Add to LinkAce" button for Firefox — saves the page you're on
to your self-hosted [LinkAce](https://www.linkace.org/) instance, with
predictive lists and tags. Talks directly to LinkAce's API using your
personal token, no login popup involved.

## Install

Get it from [addons.mozilla.org](#) *(add your AMO listing link here)*,
or grab the signed `.xpi` from this repo's [Releases](../../releases).

## Features

- **Toolbar or sidebar, your choice** — pick which one in Settings. Toolbar
  mode opens the form as a dropdown popup; sidebar mode opens it as a panel
  that can stay open while you browse.
- **Predictive lists and tags** — click into either field and your existing
  lists/tags drop down; start typing and they narrow instantly (best matches
  first, matched letters highlighted). Use ↑/↓ to move, Enter or Tab to pick,
  Esc to dismiss. Anything you've already added to the field is hidden from
  the suggestions. Type a name that doesn't exist yet and it'll tell you it
  will be created — LinkAce makes it automatically on save.
- **Grabs your text selection** — if you've highlighted something on the
  page before clicking Add, it's included as the link's description.
- Read-only against LinkAce otherwise — the extension only ever creates a
  link, never modifies or deletes anything.

## What's new in 2.0.0

- Lists and tags are now genuinely predictive. The panel loads every existing
  list and tag from your instance once when it opens and filters them locally
  as you type, so there's no lag between keystrokes and suggestions.
- The previous version asked LinkAce for suggestions at `/api/v2/lists/search`
  and `/api/v2/tags/search`, which aren't real LinkAce endpoints, so the
  dropdown never filled. 2.0.0 uses the standard `GET /api/v2/lists` and
  `GET /api/v2/tags` endpoints instead.
- The last-fetched lists/tags are cached on this device, so suggestions are
  ready the moment the panel opens. Names you create while saving are added
  to that cache right away.
- Keyboard navigation for suggestions, plus a "will be created" hint for new
  names.

## Setup

1. In LinkAce, go to **User Settings → User API Tokens** and generate a token.
2. Open the extension's Settings (right-click its icon → Manage Extension →
   Preferences, or the ⚙ Settings link inside the panel itself).
3. Enter your LinkAce URL and the token, and pick toolbar or sidebar mode.
4. Click **Save**.

## Development

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` from this repo.

## Files

```
manifest.json    Extension manifest (MV3, both action + sidebar_action)
background.js    Drives the toolbar/sidebar toggle (uiMode in storage)
sidebar.html/js  The add-link form (predictive lists/tags) — shared by popup & sidebar
options.html/js  Settings page — instance URL, API token, UI mode
icons/           Toolbar/sidebar icon
```

## License

MIT — see [LICENSE](LICENSE)

---

LinkAce Tools: Bookmark Button is a production of
**The Ministry of Digital Affairs**.
