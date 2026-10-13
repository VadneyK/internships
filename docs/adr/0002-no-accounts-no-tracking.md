# 0002. No accounts, no tracking, no third-party requests

Status: Accepted (2026-10-13)

## Context
The guide is for 12 to 18 year olds and their parents. `src/about.html` promises no accounts, no sign-up, no ads, no analytics, no cookies and no tracking. `docs/ROADMAP.md` adds that nothing a teen types leaves the browser, and that a parent can read exactly what their teen sees. `CONTRIBUTING.md` bans analytics, CDNs and tracking pixels.

## Decision
- No accounts, sign-in, analytics, cookies, ads or tracking pixels.
- No third-party requests. Fonts and images are served from this repo, and `README.md` says fonts are self-hosted.
- Answers are fixed text that a person wrote, checked against an official page and dated. There is no live chatbot (`docs/ROADMAP.md`, "Youth-first design rules").
- Anything a teen picks or saves stays in their own browser.

## Consequences
- We cannot count visitors or see what they search for. We learn from issues and pull requests instead.
- Every script, font and image is a file in the repo, so a new feature cannot lean on a hosted widget or a CDN.
- The same question always gets the same answer, which a parent or teacher can check.
- Changing this needs a new record and an update to the privacy text on the About page.
