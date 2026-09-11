# Desktop Pet (VS Code / Cursor extension)

Lets Pip notice when your **build** and **test** tasks finish, without the CLI.

It sends small POSTs to the pet's local server on `127.0.0.1:41823` — the same
endpoint the `pet` CLI and git hooks use. It is a stateless client: no pet files,
no API key, no webview.

## Install (sideload)

1. Build the VSIX from the repo root:

   ```bash
   npm run ext:package
   ```

   That writes `desktop-pet-0.2.0.vsix` in this folder.

2. In VS Code or Cursor: **Extensions → … → Install from VSIX…** and pick the file.
3. With the pet app running, run `Desktop Pet: Send test ping` from the command
   palette to confirm it can reach the pet.

## What it reacts to

Only tasks VS Code marks as a **build** or **test** group. Lint, `dev`, install,
and watch tasks are ignored (run a task with `group: "build"` to opt in). If your
build task has an unusual name and no group, set `desktopPet.taskPattern` to a
regex that matches it.

## Notes

- Local desktop only (`extensionKind: ["ui"]`). In a remote/WSL window the
  workspace host cannot reach your desktop's loopback, and the extension writes a
  one-time note to the **Desktop Pet** output channel.
- Settings: `desktopPet.port`, `desktopPet.taskPattern`.
