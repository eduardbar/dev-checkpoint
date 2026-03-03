# Show HN Post

**Best time to post:** Wednesday, 8–11AM UTC
**Note:** HN adds the link automatically from the URL field. Don't include it in the title.
**Important:** Reply to EVERY comment in the first 2 hours — HN algorithm rewards active discussions.

---

## Title

Show HN: Dev Checkpoint – Save and restore your mental context in VSCode (free, no cloud, no AI)

---

## Body

I built a VSCode extension that solves the "interruption problem" developers face constantly.

The research (Gloria Mark, UC Irvine) shows it takes 23 minutes to regain deep focus after an interruption. That context lives entirely in your head — your editor doesn't know what you were thinking.

Dev Checkpoint saves that context in one keystroke:
- Git branch + uncommitted diff summary
- Active file + cursor line + symbol under cursor
- Open TODOs/FIXMEs in the workspace
- Recently modified files (with timestamps)
- Terminal history from your current session

And restores it in 3 seconds via a sidebar panel with full narrative: "You were fixing JWT refresh token rotation in auth/middleware.ts, line 47. You had 2 open TODOs."

What makes it different from workspace restore:
- It captures INTENT, not just state
- The narrative is heuristic (deterministic NLP, no AI/LLM)
- Works completely offline, zero cloud, zero deps beyond VSCode API
- Auto-saves on idle detection (configurable threshold)

Tech details for those who care:
- TypeScript + React webview
- esbuild for bundling (extension.js = 20KB, webview.js = 145KB)
- 62 unit tests (Vitest)
- MIT license

Free, open source: https://github.com/eduardbar/dev-checkpoint
VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=eduardbar.dev-checkpoint

Curious what the HN crowd thinks — is the "23 min" framing accurate to your experience, or do you recover faster?
