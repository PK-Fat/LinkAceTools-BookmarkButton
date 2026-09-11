# LinkAce Tools: Bookmark Button

A one-click "Add to LinkAce" button for Firefox — saves the page you're on
to your self-hosted [LinkAce](https://www.linkace.org/) instance, with
autocomplete for lists and tags. Talks directly to LinkAce's API using your
personal token, no login popup involved.

## Install

Get it from [addons.mozilla.org](#) *(add your AMO listing link here)*,
or grab the signed `.xpi` from this repo's [Releases](../../releases).

## Features

- **Toolbar or sidebar, your choice** — pick which one in Settings. Toolbar
  mode opens the form as a dropdown popup; sidebar mode opens it as a panel
  that can stay open while you browse.
- **Lists and tags with autocomplete** — start typing and it suggests
  existing lists/tags from your instance, but nothing stops you from typing
  a new one; LinkAce creates it automatically on save.
- **Grabs your text selection** — if you've highlighted something on the
  page before clicking Add, it's included as the link's description.
- Read-only against LinkAce otherwise — the extension only ever creates a
  link, never modifies or deletes anything.

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
sidebar.html/js  The add-link form — shared by both popup and sidebar modes
options.html/js  Settings page — instance URL, API token, UI mode
icons/           Toolbar/sidebar icon
```

## License

MIT — see [LICENSE](LICENSE)
