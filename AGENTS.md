# AGENTS.md

Instructions for coding agents working on this repository.

## Project

**AI Desktop Pet** — a small AI-powered companion that lives on the developer's desktop while they work.

The pet is not primarily a chatbot. It is a persistent digital companion that:

- lives on the desktop
- reacts to the user's activity
- has a persistent personality
- has mood and needs
- gains experience and levels up
- reacts to developer events such as commits, builds and tests
- occasionally interacts with the user through short, contextual messages
- remembers meaningful interactions
- feels alive without becoming annoying

Core experience:

> "There is a little creature living on my computer that knows I'm here."

The product should feel playful, polished and surprisingly alive.

Source spec: `project.md`. If this file and `project.md` disagree, prefer `project.md` for product intent and this file for how to work in the repo.

---

## Product principles

Follow these while designing, implementing, and reviewing work.

### 1. Pet first, AI second

Do not build a chatbot with a pet UI. The pet itself is the product.

The AI exists to provide personality, contextual reactions and memory.

Most basic behaviour should be deterministic and should **not** require an LLM.

Examples:

- Git commit → gain XP
- Build succeeds → become happy
- Build fails → become sad
- Long inactivity → become sleepy
- Pet ignored for a long time → become annoyed
- Pet fed → hunger decreases

Use AI only when generative behaviour adds genuine value.

### 2. Small and fun beats technically impressive

This is a weekend project.

Do not introduce infrastructure simply because it is possible.

Prefer:

- simple architecture
- local storage
- minimal dependencies
- straightforward APIs
- boring persistence
- small components

Avoid:

- microservices
- Kubernetes
- event buses
- distributed databases
- unnecessary abstractions
- complicated authentication
- premature scalability work

### 3. The pet must feel alive

The pet should not remain visually static. It should have states and animations.

Example states:

- idle
- happy
- excited
- sad
- angry
- sleepy
- sleeping
- eating
- thinking
- celebrating
- curious

Transitions should happen naturally.

---

## MVP scope

The first version must contain the following. Do not expand scope unless asked.

### Desktop pet

- Always-on-top window
- Small footprint
- Transparent or minimal window chrome
- Pet character
- Basic animations
- Click interaction
- Hide/show behaviour

### Pet state

The pet has:

- name
- level
- XP
- happiness
- energy
- hunger
- mood
- current state

### Developer activity

Track:

- Git commits
- Git pushes
- build success
- build failure
- test success
- test failure
- user idle time

### Reactions

The pet reacts to events. Examples:

```text
COMMIT
→ +XP
→ happy animation

BUILD SUCCESS
→ excited
→ +happiness

BUILD FAILURE
→ sad
→ contextual reaction

MULTIPLE FAILURES
→ concerned/annoyed
→ AI reaction may be generated

LONG IDLE
→ sleepy

RETURN FROM IDLE
→ greeting
```

---

## Working agreements

- Keep changes small and local. One concern per change.
- Implement deterministic pet behaviour (state, XP, mood, activity reactions) before any LLM integration.
- Do not add chat UI, cloud backends, accounts, or extra services unless the user asks.
- Persistence must be local and boring (file or local DB). No distributed store.
- Prefer existing, ordinary libraries over custom frameworks.
- Do not invent product features beyond the MVP above.
- Match surrounding code style once implementation exists. Until then, keep the codebase small and obvious.
- Comments should be short and only explain non-obvious constraints.
- Do not add docs, CI, or tooling the user did not ask for.

## Out of scope until asked

- Chatbot / conversation-first UI
- Multiplayer, social, or sharing features
- Cloud sync, accounts, or telemetry
- Plugin marketplaces
- Microservices or remote pet backends
