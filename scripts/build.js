/**
 * FYShuffle Build Script
 *
 * This Node.js script assembles and outputs standalone JavaScript bundles for different environments:
 *
 * - browser (UMD-style):   dist/FYShuffle.js
 * - node (CommonJS):       dist/FYShuffle.node.cjs
 * - esm (ES Modules):      dist/FYShuffle.module.js
 *
 * Key Features:
 * - Assembles source files per target (defined in `sources`)
 * - Strips `import` and `export` lines while preserving function/const/class declarations
 * - Beautifies output using Prettier
 * - Minifies browser build using Terser (dist/FYShuffle.min.js)
 * - Supports CLI flags:
 *     --target=<name>   Build only a specific target (browser, node, esm)
 *     --release         Build package.json version artifacts even before the tag exists
 *     -v / --verbose    Show stripped import/export lines during build
 *
 * Usage:
 *   npm run build
 *   npm run build -- --target=node
 *   npm run build -- --target=browser --verbose
 *
 * Requires:
 *   - Node 16+
 *   - Installed dev dependencies:
 *       npm install --save-dev prettier terser
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import prettier from 'prettier';
import * as terser from 'terser';
import { resolveBuildVersion, resolveStableVersion } from './build-version.js';

const __dirname = path.resolve();
const distDir = path.join(__dirname, 'dist');
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
const execFileAsync = promisify(execFile);

const sources = {
  browser: [
    'src/fyshuffle-core.js',
    'src/core/base64.browser.js',
    'src/fyshuffle-crypto.js',
    'src/fyshuffle-dom.js',
  ],
  node: [
    'src/fyshuffle-core.js',
    'src/core/base64.node.js',
    'src/fyshuffle-crypto.js',
  ],
  esm: [
    'src/fyshuffle-core.js',
    'src/core/base64.node.js',
    'src/fyshuffle-crypto.js',
  ],
};

const targets = {
  browser: {
    out: 'FYShuffle.js',
    banner: '/* FYShuffle.js — browser (UMD-style) */',
  },
  node: {
    out: 'FYShuffle.node.cjs',
    banner: '/* FYShuffle — Node (CommonJS) */',
  },
  esm: {
    out: 'FYShuffle.module.js',
    banner: '/* FYShuffle — ES module */',
  },
};

const args = process.argv.slice(2);
const targetArg = args.find((arg) => arg.startsWith('--target='));
const onlyTarget = targetArg ? targetArg.split('=')[1] : null;
const isVerbose = args.includes('-v') || args.includes('--verbose');
const isReleaseOverride = args.includes('--release');

async function getTagsAtHead() {
  try {
    const { stdout } = await execFileAsync('git', ['tag', '--points-at', 'HEAD'], {
      cwd: __dirname,
    });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

async function getAllTags() {
  try {
    const { stdout } = await execFileAsync('git', ['tag', '--list'], {
      cwd: __dirname,
    });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

const allTags = await getAllTags();
const buildVersion = resolveBuildVersion({
  packageVersion: pkg.version,
  releaseOverride: isReleaseOverride,
  tagsAtHead: await getTagsAtHead(),
  allTags,
});
const stableBrowserVersion = resolveStableVersion({
  packageVersion: pkg.version,
  buildVersion,
  allTags,
});
const isReleaseBuild = buildVersion === pkg.version;
const browserLegacyFile = isReleaseBuild ? 'FYShuffle.js' : 'FYShuffle-dev.js';
const staleDevArtifactPattern =
  /^FYShuffle(?:\.module|\.node)?\.v\d+\.\d+\.\d+-dev\.(?:js|cjs)$/;

function stripModuleSyntax(code, filePath) {
  return code
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('import')) {
        if (isVerbose) console.log(`⚠️  Stripped import from ${filePath}: ${trimmed}`);
        return null;
      }
      const exportMatch = trimmed.match(/^export\s+(function|const|let|var|class)\s/);
      if (exportMatch) {
        if (isVerbose) console.log(`⚠️  Removed 'export' from ${filePath}: ${trimmed}`);
        return line.replace(/^export\s+/, '');
      }
      if (trimmed.startsWith('export')) {
        if (isVerbose) console.log(`⚠️  Stripped export from ${filePath}: ${trimmed}`);
        return null;
      }
      return line;
    })
    .filter(Boolean)
    .join('\n');
}

async function buildTarget(targetKey) {
  const { out, banner } = targets[targetKey];
  const files = sources[targetKey];

  try {
    const contents = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(__dirname, file);
        const raw = await fs.readFile(fullPath, 'utf8');
        return stripModuleSyntax(raw, file);
      })
    );

    let combined = `${banner}\n\n${contents.join('\n\n')}`;

    if (targetKey === 'node') {
      combined += `\n\nmodule.exports = { FYForward, FYBackward, genPerm, nextRand };`;
    }
    if (targetKey === 'esm') {
      combined += `\n\nexport { FYForward, FYBackward, genPerm, nextRand };`;
    }

    const output = await prettier.format(combined, {
      parser: 'babel',
      semi: true,
      singleQuote: true,
    });

    await fs.mkdir(distDir, { recursive: true });

    if (targetKey === 'browser') {
      const legacyWarning = `console.warn('FYShuffle: You are using the unversioned ${browserLegacyFile}. For long-term stability, consider switching to a stable versioned file like FYShuffle.v${stableBrowserVersion}.js');\n\n`;
      const combinedWithWarning = legacyWarning + combined;

      const formattedLegacy = await prettier.format(combinedWithWarning, {
        parser: 'babel',
        semi: true,
        singleQuote: true,
      });

      const legacyPath = path.join(distDir, browserLegacyFile);
      await fs.writeFile(legacyPath, formattedLegacy, 'utf8');
      console.log(`✔️  Built ${browserLegacyFile} (with legacy warning)`);

      if (isReleaseBuild) {
        const minified = await terser.minify(combined);
        const minPath = path.join(distDir, 'FYShuffle.min.js');
        await fs.writeFile(minPath, minified.code, 'utf8');
        console.log(`✔️  Minified FYShuffle.min.js`);
      }
    } else {
      const outputPath = path.join(distDir, out);
      await fs.writeFile(outputPath, output, 'utf8');
      console.log(`✔️  Built ${out}`);
    }

    // Write versioned file
    const versionedName = out.replace(/(\.c?js)$/, `.v${buildVersion}$1`);
    const versionedPath = path.join(distDir, versionedName);
    await fs.writeFile(versionedPath, output, 'utf8');
    console.log(`📦  Wrote versioned: ${versionedName}`);

    return { target: targetKey, versioned: versionedName, success: true };
  } catch (err) {
    console.error(`❌ Build failed for ${targetKey}: ${err.message}`);
    return { target: targetKey, success: false };
  }
}

async function generateManifest(version) {
  const manifest = {
    $schema: 'https://example.com/fyshuffle/manifest.schema.json',
    schemaStatus: 'unstable',
    version,
    files: {
      browser: {
        legacy: 'FYShuffle.js',
        stable: `FYShuffle.v${stableBrowserVersion}.js`,
        ...(isReleaseBuild ? {} : { dev: browserLegacyFile }),
        versioned: `FYShuffle.v${version}.js`,
      },
      node: {
        legacy: 'FYShuffle.node.cjs',
        versioned: `FYShuffle.node.v${version}.cjs`,
      },
      esm: {
        legacy: 'FYShuffle.module.js',
        versioned: `FYShuffle.module.v${version}.js`,
      },
    },
  };

  const outPath = path.join(distDir, 'manifest.json');
  await fs.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log('📝 Wrote manifest.json');
}

async function updatePackageJson(version) {
  const files = [
    `dist/${browserLegacyFile}`,
    `dist/FYShuffle.v${version}.js`,
    ...(isReleaseBuild ? ['dist/FYShuffle.min.js'] : []),
    'dist/FYShuffle.node.cjs',
    `dist/FYShuffle.node.v${version}.cjs`,
    'dist/FYShuffle.module.js',
    `dist/FYShuffle.module.v${version}.js`,
    'dist/FYShuffle.d.ts',
    'dist/manifest.json',
    'dist/README.md',
    'dist/LICENSE',
    'bin/fyshuffle.js',
  ];

  const pkgRaw = await fs.readFile(pkgPath, 'utf8');
  const pkgJson = JSON.parse(pkgRaw);
  pkgJson.files = files;
  await fs.writeFile(pkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`, 'utf8');
  console.log('📝 Updated package.json files list');
}

async function removeStaleDevArtifacts() {
  try {
    const entries = await fs.readdir(distDir);
    await Promise.all(
      entries
        .filter((entry) => staleDevArtifactPattern.test(entry))
        .map(async (entry) => {
          await fs.unlink(path.join(distDir, entry));
          console.log(`🧹 Removed stale dev artifact: ${entry}`);
        })
    );
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

async function buildAll() {
  await removeStaleDevArtifacts();

  const keysToBuild = onlyTarget
    ? Object.keys(targets).includes(onlyTarget)
      ? [onlyTarget]
      : (console.error(`❌ Unknown target: ${onlyTarget}`), process.exit(1))
    : Object.keys(targets);

  const results = await Promise.all(keysToBuild.map(buildTarget));
  const failed = results.filter((r) => !r.success);

  if (failed.length === 0) {
    console.log('✅ All builds completed successfully');
  } else {
    console.log('\n⚠️ Some builds failed:');
    failed.forEach((r) => console.log(` - ${r.target}`));
    process.exitCode = 1;
  }

  await generateManifest(buildVersion);
  await updatePackageJson(buildVersion);
}

buildAll();
