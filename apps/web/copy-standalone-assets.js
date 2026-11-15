const fs = require('fs');
const path = require('path');

const webDir = __dirname;
const rootDir = path.resolve(webDir, '..', '..');
const standaloneDir = path.join(webDir, '.next', 'standalone');
const standaloneWebDir = path.join(standaloneDir, 'apps', 'web');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    try {
      if (entry.isDirectory()) {
        copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (e) {
      // Ignore individual file copy errors
    }
    // Clean up .pnpm folder inside standalone so archive tools and Windows don't choke on path length
    try {
      fs.rmSync(pnpmDir, { recursive: true, force: true });
      console.log('[Standalone] Cleaned up .pnpm directory from standalone build.');
    } catch (_) {}
  }
}

if (fs.existsSync(standaloneDir)) {
  console.log('[Standalone] Step 1: Copying static and public assets...');
  const publicDir = path.join(webDir, 'public');
  const staticDir = path.join(webDir, '.next', 'static');

  if (fs.existsSync(standaloneWebDir)) {
    copyDirSync(publicDir, path.join(standaloneWebDir, 'public'));
    copyDirSync(staticDir, path.join(standaloneWebDir, '.next', 'static'));
  }

  copyDirSync(publicDir, path.join(standaloneDir, 'public'));
  copyDirSync(staticDir, path.join(standaloneDir, '.next', 'static'));

  console.log('[Standalone] Step 2: Flattening pnpm packages into standalone node_modules...');
  const pnpmDir = path.join(standaloneDir, 'node_modules', '.pnpm');
  const targetStandaloneNm = path.join(standaloneDir, 'node_modules');
  const targetAppsWebNm = path.join(standaloneWebDir, 'node_modules');

  if (fs.existsSync(pnpmDir)) {
    const pnpmEntries = fs.readdirSync(pnpmDir);
    for (const entry of pnpmEntries) {
      const pnpmNm = path.join(pnpmDir, entry, 'node_modules');
      if (!fs.existsSync(pnpmNm)) continue;

      const pkgs = fs.readdirSync(pnpmNm);
      for (const pkg of pkgs) {
        const srcPkg = path.join(pnpmNm, pkg);
        const dest1 = path.join(targetStandaloneNm, pkg);
        const dest2 = path.join(targetAppsWebNm, pkg);

        if (pkg.startsWith('@')) {
          const subPkgs = fs.readdirSync(srcPkg);
          for (const sub of subPkgs) {
            const subSrc = path.join(srcPkg, sub);
            const subDest1 = path.join(dest1, sub);
            const subDest2 = path.join(dest2, sub);
            fs.mkdirSync(path.dirname(subDest1), { recursive: true });
            fs.mkdirSync(path.dirname(subDest2), { recursive: true });
            if (!fs.existsSync(subDest1)) {
              try { fs.cpSync(subSrc, subDest1, { recursive: true, dereference: true }); } catch (_) {}
            }
            if (!fs.existsSync(subDest2)) {
              try { fs.cpSync(subSrc, subDest2, { recursive: true, dereference: true }); } catch (_) {}
            }
          }
        } else {
          if (!fs.existsSync(dest1)) {
            try { fs.cpSync(srcPkg, dest1, { recursive: true, dereference: true }); } catch (_) {}
          }
          if (!fs.existsSync(dest2)) {
            try { fs.cpSync(srcPkg, dest2, { recursive: true, dereference: true }); } catch (_) {}
          }
        }
      }
    }
    // Clean up .pnpm folder inside standalone so archive tools and Windows don't choke on path length
    try {
      fs.rmSync(pnpmDir, { recursive: true, force: true });
      console.log('[Standalone] Cleaned up .pnpm directory from standalone build.');
    } catch (_) {}
  }

  try { fs.rmSync(pnpmDir, { recursive: true, force: true }); console.log('[Standalone] Cleaned up .pnpm from standalone.'); } catch (_) {}

  console.log('[Standalone] Step 3: Ensuring critical packages from root node_modules...');
  const criticalPackages = [
    '@next/env',
    '@swc/helpers',
    'nanoid',
    'styled-jsx',
    'busboy',
    'streamsearch',
    'react',
    'react-dom',
    'client-only',
    'scheduler'
  ];

  for (const pkg of criticalPackages) {
    const rootSrc = path.join(rootDir, 'node_modules', pkg);
    const dest1 = path.join(targetStandaloneNm, pkg);
    const dest2 = path.join(targetAppsWebNm, pkg);

    if (fs.existsSync(rootSrc)) {
      try {
        fs.mkdirSync(path.dirname(dest1), { recursive: true });
        fs.cpSync(rootSrc, dest1, { recursive: true, dereference: true, force: true });
      } catch (_) {}
      try {
        fs.mkdirSync(path.dirname(dest2), { recursive: true });
        fs.cpSync(rootSrc, dest2, { recursive: true, dereference: true, force: true });
      } catch (_) {}
    }
    // Clean up .pnpm folder inside standalone so archive tools and Windows don't choke on path length
    try {
      fs.rmSync(pnpmDir, { recursive: true, force: true });
      console.log('[Standalone] Cleaned up .pnpm directory from standalone build.');
    } catch (_) {}
  }

  // Next's standalone output can leave symlinks in the copied node_modules
  // (for example `next` and `react`). A later `next build` cleans .next and on
  // Windows can follow those links, deleting files from the root node_modules.
  // Every package is already present as a real directory one level up, so drop
  // the links to keep builds safe.
  function removeSymlinks(dir) {
    let removed = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      let stat;
      try {
        stat = fs.lstatSync(entryPath);
      } catch (_) {
        continue;
      }
      if (stat.isSymbolicLink()) {
        try {
          fs.unlinkSync(entryPath);
          removed += 1;
        } catch (_) {}
      } else if (stat.isDirectory()) {
        removed += removeSymlinks(entryPath);
      }
    }
    return removed;
  }

  try {
    const removed = removeSymlinks(standaloneDir);
    if (removed > 0) {
      console.log(
        `[Standalone] Removed ${removed} symlink(s) so future builds cannot delete packages outside .next.`,
      );
    }
  } catch (_) {}

  console.log('[Standalone] All standalone assets and dependencies verified successfully.');
}
