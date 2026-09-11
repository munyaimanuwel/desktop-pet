// Install git hooks that POST to the pet's localhost server.
// The hook body must be portable: it may run from any repo, so it never
// references this checkout, and it uses http.request (not fetch) so an older
// Node on the hook PATH still works.
const fs = require('fs');
const path = require('path');

const HOOKS = {
  'post-commit': 'COMMIT',
  'pre-push': 'PUSH',
};

function hookBody(type) {
  return (
    '#!/bin/sh\n' +
    `node -e "var h=require('http');var b=JSON.stringify({type:'${type}',source:'hook'});` +
    "var r=h.request({host:'127.0.0.1',port:41823,path:'/event',method:'POST'," +
    "headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}}," +
    "function(res){res.resume()});r.on('error',function(){});r.end(b);\" >/dev/null 2>&1 &\n"
  );
}

function isGitRoot(dir) {
  try {
    return fs.existsSync(path.join(dir || process.cwd(), '.git'));
  } catch {
    return false;
  }
}

// Write missing hooks; never overwrite an existing one.
function installHooks(repoDir) {
  const root = repoDir || process.cwd();
  const hooksDir = path.join(root, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) return { ok: false, written: [], skipped: [] };
  const written = [];
  const skipped = [];
  for (const [name, type] of Object.entries(HOOKS)) {
    const file = path.join(hooksDir, name);
    if (fs.existsSync(file)) {
      skipped.push(name);
      continue;
    }
    fs.writeFileSync(file, hookBody(type), { mode: 0o755 });
    written.push(name);
  }
  return { ok: true, written, skipped };
}

module.exports = { installHooks, isGitRoot, hookBody, HOOKS };
