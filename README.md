# NoScroll

A small personal iPhone app that shows the official Instagram website without the Reels feed.

- The Reels tab is hidden.
- The endless Reels feed cannot be opened.
- A single reel that someone sent you plays normally. Moving on to the next reel sends you back to where you were.
- Everything else (feed, stories, messages, search, posting) is the regular website.

The app stores nothing and sends nothing anywhere. You log in on Instagram's own page.

## Where things are

| File | What it does |
|---|---|
| `NoScroll/Blocker.swift` | What gets hidden and blocked. The only file to edit to change the rules. |
| `NoScroll/BrowserModel.swift` | The web view and its navigation rules. |
| `NoScroll/NoScrollApp.swift` | The app screen. |
| `project.yml` | Project settings (XcodeGen). |
| `.github/workflows/build.yml` | Cloud build: produces `NoScroll.ipa` on every push. |
| `tools/test-blocker.mjs` | Tests for the blocking rules: `node tools/test-blocker.mjs` |
| `tools/make-icon.mjs` | Draws the app icon: `node tools/make-icon.mjs` |

## Build

Every push to `main` builds an unsigned `NoScroll.ipa` and publishes it under Releases as `latest`.
Install it on your own iPhone with a sideloading tool and a free Apple ID. It needs a refresh every 7 days.
