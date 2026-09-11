// Desktop Pet — VS Code / Cursor extension.
// It is a stateless client of the pet's localhost event server: it POSTs
// classified build/test task results and nothing else. No webview, no chat,
// no pet files, no API key.
const http = require('http');
const vscode = require('vscode');
const { eventFor } = require('./classify');

const OUTPUT_NAME = 'Desktop Pet';
const DEFAULT_PORT = 41823;

let out = null;
let remoteNoted = false;

function port() {
  const n = vscode.workspace.getConfiguration('desktopPet').get('port');
  return typeof n === 'number' && n > 0 && n < 65536 ? n : DEFAULT_PORT;
}

function extraPattern() {
  const raw = vscode.workspace.getConfiguration('desktopPet').get('taskPattern');
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return new RegExp(raw);
  } catch {
    return null;
  }
}

function noteRemoteOnce() {
  if (remoteNoted) return;
  remoteNoted = true;
  if (out) {
    out.appendLine(
      'This window is remote/WSL. Pip lives on your desktop; workspace build tasks may not reach it.'
    );
  }
}

// POST first; a refused connection is quiet (the pet may simply be closed).
function post(type) {
  return new Promise((resolve) => {
    let body;
    try {
      body = JSON.stringify({ type, source: 'vscode' });
    } catch {
      resolve(false);
      return;
    }
    const req = http.request(
      {
        host: '127.0.0.1',
        port: port(),
        path: '/event',
        method: 'POST',
        timeout: 1000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 204);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end(body);
  });
}

function activate(context) {
  out = vscode.window.createOutputChannel(OUTPUT_NAME);
  context.subscriptions.push(out);

  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      try {
        if (vscode.env.remoteName) noteRemoteOnce();
        const task = e.execution && e.execution.task;
        const type = eventFor(task, e.exitCode, extraPattern());
        if (!type) {
          out.appendLine(`[trace] ignored task: ${(task && task.name) || '(unknown)'}`);
          return;
        }
        void post(type);
      } catch (err) {
        out.appendLine(`[trace] ${(err && err.stack) || err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('desktopPet.ping', () => {
      if (vscode.env.remoteName) noteRemoteOnce();
      return post('BUILD_SUCCESS');
    })
  );

  // Pushes: use the built-in Git extension when it exposes onDidPublish.
  const gitExt = vscode.extensions.getExtension('vscode.git');
  if (gitExt && gitExt.activate) {
    Promise.resolve(gitExt.activate())
      .then((git) => {
        const api = git && git.getAPI && git.getAPI(1);
        if (api && api.onDidPublish) {
          context.subscriptions.push(api.onDidPublish(() => void post('PUSH')));
        }
      })
      .catch(() => {});
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
