const fs = require('fs');
const path = require('path');

const webDir = __dirname;
const standaloneDir = path.join(webDir, '.next', 'standalone');
const standaloneWebDir = path.join(standaloneDir, 'apps', 'web');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(standaloneDir)) {
  console.log('[Standalone] Copying static and public assets...');
  const publicDir = path.join(webDir, 'public');
  const staticDir = path.join(webDir, '.next', 'static');

  // Copy to standalone/apps/web/
  if (fs.existsSync(standaloneWebDir)) {
    copyDirSync(publicDir, path.join(standaloneWebDir, 'public'));
    copyDirSync(staticDir, path.join(standaloneWebDir, '.next', 'static'));

    // Ensure node_modules junction points correctly
    const webNodeModules = path.join(standaloneWebDir, 'node_modules');
    const rootNodeModules = path.join(standaloneDir, 'node_modules');
    if (fs.existsSync(rootNodeModules)) {
      try {
        const stats = fs.lstatSync(webNodeModules);
        if (!stats.isDirectory()) {
          fs.rmSync(webNodeModules, { recursive: true, force: true });
          fs.symlinkSync(rootNodeModules, webNodeModules, 'junction');
        }
      } catch (e) {
        try {
          fs.symlinkSync(rootNodeModules, webNodeModules, 'junction');
        } catch (_) {}
      }
    }
  }

  // Copy to standalone root as fallback
  copyDirSync(publicDir, path.join(standaloneDir, 'public'));
  copyDirSync(staticDir, path.join(standaloneDir, '.next', 'static'));

  console.log('[Standalone] Assets copied successfully.');
}
