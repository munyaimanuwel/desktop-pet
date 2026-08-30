# AI Desktop Pet

A small AI-powered companion that lives on your desktop while you work.

The pet is not a chatbot. It is a persistent digital creature that notices you: your commits, your builds, your idle stretches, and the quiet in between.

> "There is a little creature living on my computer that knows I'm here."

## What it does

- Lives in a small always-on-top window
- Has mood, needs, XP, and a level
- Reacts to developer activity (git, builds, tests, idle time)
- Animates between states instead of sitting still
- Speaks up only occasionally, and only when it is worth it

## Status

Early planning. Implementation has not started.

See `project.md` for the product spec and `AGENTS.md` for how coding agents should work in this repo.

## Principles

**Pet first, AI second.** Most behaviour is deterministic. AI is for personality, memory, and the occasional contextual line — not for every click.

**Small and fun.** Local storage, few dependencies, no extra infrastructure.

**Feels alive.** Idle, happy, sleepy, celebrating, and the rest should read on the creature, not only in a status field.
