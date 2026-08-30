# AGENTS.md

## Project: AI Desktop Pet

## 1. Vision

Build a small AI-powered desktop pet that lives alongside the developer while they work.

The pet is not primarily a chatbot.

It is a persistent digital companion that:

- lives on the desktop
- reacts to the user's activity
- has a persistent personality
- has mood and needs
- gains experience and levels up
- reacts to developer events such as commits, builds and tests
- occasionally interacts with the user through short, contextual messages
- remembers meaningful interactions
- feels alive without becoming annoying

The core experience should be:

> "There is a little creature living on my computer that knows I'm here."

The product should feel playful, polished and surprisingly alive.

---

# 2. Product Principles

### 2.1 Pet first, AI second

Do not build a chatbot with a pet UI.

The pet itself is the product.

The AI exists to provide personality, contextual reactions and memory.

Most basic behaviour should be deterministic and should NOT require an LLM.

Examples:

- Git commit → gain XP
- Build succeeds → become happy
- Build fails → become sad
- Long inactivity → become sleepy
- Pet ignored for a long time → become annoyed
- Pet fed → hunger decreases

Use AI only when generative behaviour adds genuine value.

---

### 2.2 Small and fun beats technically impressive

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

---

### 2.3 The pet must feel alive

The pet should not remain visually static.

It should have states and animations.

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

# 3. Initial Product Scope

## MVP

The first version must contain:

### Desktop Pet

- Always-on-top window
- Small footprint
- Transparent or minimal window chrome
- Pet character
- Basic animations
- Click interaction
- Hide/show behaviour

### Pet State

The pet has:

- name
- level
- XP
- happiness
- energy
- hunger
- mood
- current state

### Developer Activity

Track:

- Git commits
- Git pushes
- build success
- build failure
- test success
- test failure
- user idle time

### Reactions

The pet reacts to events.

Examples:

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