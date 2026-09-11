# AI Desktop Pet

A small companion that lives on your desktop while you work.

The pet is not a chatbot. It is a persistent digital creature that notices you: your commits, your builds, your idle stretches, and the quiet in between.

> "There is a little creature living on my computer that knows I'm here."

## What it does

- Lives in a small always-on-top window (Pip, a purple blob)
- Walks the bottom of your screen (the taskbar edge) and can hop to a second monitor
- Blinks, and faces the way it is walking
- Has mood, needs, XP, and a level
- Remembers today's work — and notable moments (a long red build, a first push in days, a rename)
- Reacts to developer activity (git, builds, tests, idle time)
- Speaks up only occasionally — quiet and off modes if you need focus
- Hides in the system tray (`Ctrl+Alt+P` / `Cmd+Alt+P` to show/hide)
- Optional AI one-liners for rare moments (level-up, a pile of failures, good morning,
  long absence, end of day), capped at 4 a day

## Run it

```bash
npm install
npm test
npm run electron:dev
```

`electron:dev` starts the Next.js renderer and opens the frameless pet window.

```bash
npm run electron:prod   # packaged renderer, no Next dev server
npm run dist            # Windows installer in release/
```

## Using Pip

- **Click** to pet · **Drag** to move
- **Right-click** for the menu: Settings…, Feed, wander, speech, quit
- **Settings…** opens the stats/settings panel (Esc or a click elsewhere closes it)
- **Feed** from the panel or the menu
- **Ctrl+Alt+P** / **Cmd+Alt+P** shows or hides the window

With Wander on, Pip walks the taskbar edge and can hop to another monitor. Drop it
somewhere with Wander off to park it there; turn Wander on and it returns to the floor.

State lives in Electron's userData directory (`pet.json` and `settings.json`).

## Feed it events

The pet watches `git rev-parse HEAD` in the current working directory (or the repo you set in Settings).

From any other repo, ping the local event server:

```bash
npm run pet -- commit
npm run pet -- push
npm run pet -- build-success
npm run pet -- build-failure
npm run pet -- test-success
npm run pet -- test-failure
```

Optional git hooks in this repo: `npm run hooks:install`

### From VS Code / Cursor

Sideload the bundled extension so builds and tests reach Pip without a CLI:

```bash
npm run ext:package
```

Then in VS Code or Cursor: **Extensions → … → Install from VSIX…** and pick
`extensions/vscode/desktop-pet-0.2.0.vsix`. It is local-desktop only (a remote/WSL
window cannot reach your desktop's loopback) and only reacts to tasks VS Code marks
as a build or test. Details: [`extensions/vscode/README.md`](extensions/vscode/README.md).

## Optional AI

Most behaviour is deterministic. If you set `XAI_API_KEY` (env, `.env`, or Settings), Pip may generate a short line for level-ups, repeated failures, greetings, long absences, and the end of the day. Otherwise the canned line is used. Generation is capped at one line per 30 minutes and 4 a day.

## Sprite art (optional)

Pip is drawn as an SVG by default. To use a sprite sheet instead, drop two files
in `public/`:

```
public/pip.png    # 768x96, eight 96x96 frames
public/pip.json   # { "frame": { "w": 96, "h": 96 }, "animations": { "idle": [0,1], "walk": [2,3,4,5], ... } }
```

If `pip.json` is missing, the SVG path is used — art is optional and never blocks a release.

## Updates

Packaged builds check GitHub Releases on launch and once a day, download quietly, and install on quit. Turn it off with the **Check for updates** setting.

## Principles

**Pet first, AI second.** Most behaviour is deterministic. AI is for personality, memory, and the occasional contextual line — not for every click.

**Small and fun.** Local storage, few dependencies, no extra infrastructure.

**Feels alive.** Idle, happy, sleepy, celebrating, walking, and the rest should read on the creature, not only in a status field.

See `project.md` for the product spec, `docs/v2.md` for the v2 plan, and `AGENTS.md` for how coding agents should work in this repo.

## Status

The **2.0** cut is done: walk the taskbar and hop monitors, plus a VS Code/Cursor extension so builds and tests arrive without a CLI. The **2.1** work — journal facts with deterministic recall, rarer capped AI, the sprite-sheet loader, compact window, macOS dmg, and quiet GitHub auto-update — is implemented here too.

Still open: code signing (Windows Authenticode / Apple notarization) and making the GitHub repo public for unauthenticated updates. Full design, decisions, and PR order: [`docs/v2.md`](docs/v2.md).
