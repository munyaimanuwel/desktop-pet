// Quiet auto-update from GitHub Releases. No modal, install on quit.
// electron-updater is lazy-required so a dev build without it still starts.
const DAY_MS = 24 * 60 * 60 * 1000;

function initUpdater({ onDownloaded, log = console } = {}) {
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    log.info('[pet] electron-updater not installed — skipping update checks');
    return { stop() {} };
  }

  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (err) => log.warn('[pet] update failed:', (err && err.message) || err));
    autoUpdater.on('update-downloaded', (info) => {
      log.info(`[pet] update downloaded: ${(info && info.version) || 'unknown'}`);
      if (onDownloaded) onDownloaded(info);
    });
    const check = () => {
      Promise.resolve(autoUpdater.checkForUpdates()).catch(() => {});
    };
    check();
    const timer = setInterval(check, DAY_MS);
    return {
      stop() {
        clearInterval(timer);
      },
    };
  } catch (err) {
    log.warn('[pet] updater unavailable', err);
    return { stop() {} };
  }
}

module.exports = { initUpdater };
