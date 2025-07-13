/**
 * FYShuffle Build Script
 *
 * This Node.js script assembles and outputs standalone JavaScript bundles for different environments:
 *
 * - browser (UMD-style):   dist/FYShuffle.js
 * - node (CommonJS):       dist/FYShuffle.node.js
 * - esm (ES Modules):      dist/FYShuffle.module.js
 *
 * Key Features:
 * - Assembles source files per target (defined in `sources`)
 * - Strips `import` and `export` lines while preserving function/const/class declarations
 * - Beautifies output using Prettier
 * - Minifies browser build using Terser (dist/FYShuffle.min.js)
 * - Supports CLI flags:
 *     --target=<name>   Build only a specific target (browser, node, esm)
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
import prettier from 'prettier';
import * as terser from 'terser';

const __dirname = path.resolve();
const distDir = path.join(__dirname, 'dist');
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));

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
    out: 'FYShuffle.node.js',
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

    const outputPath = path.join(distDir, out);
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(outputPath, output, 'utf8');
    console.log(`✔️  Built ${out}`);

    if (targetKey === 'browser') {
      const legacyWarning = `console.warn('FYShuffle: You are using the unversioned FYShuffle.js. For long-term stability, consider switching to a versioned file like FYShuffle.v${pkg.version}.js');\n\n`;
      const combinedWithWarning = legacyWarning + combined;

      const formattedLegacy = await prettier.format(combinedWithWarning, {
        parser: 'babel',
        semi: true,
        singleQuote: true,
      });

      const legacyPath = path.join(distDir, 'FYShuffle.js');
      await fs.writeFile(legacyPath, formattedLegacy, 'utf8');
      console.log(`✔️  Built FYShuffle.js (with legacy warning)`);

      const minified = await terser.minify(combined);
      const minPath = path.join(distDir, 'FYShuffle.min.js');
      await fs.writeFile(minPath, minified.code, 'utf8');
      console.log(`✔️  Minified FYShuffle.min.js`);
    }

    // Write versioned file
    const versionedName = out.replace(/\.js$/, `.v${pkg.version}.js`);
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
        versioned: `FYShuffle.v${version}.js`,
      },
      node: {
        legacy: 'FYShuffle.node.js',
        versioned: `FYShuffle.node.v${version}.js`,
      },
      esm: {
        legacy: 'FYShuffle.module.js',
        versioned: `FYShuffle.module.v${version}.js`,
      },
    },
  };

  const outPath = path.join(distDir, 'manifest.json');
  await fs.writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('📝 Wrote manifest.json');
}

async function updatePackageJson(version) {
  const files = [
    'FYShuffle.js',
    `FYShuffle.v${version}.js`,
    'FYShuffle.min.js',
    'FYShuffle.node.js',
    `FYShuffle.node.v${version}.js`,
    'FYShuffle.module.js',
    `FYShuffle.module.v${version}.js`,
    'FYShuffle.d.ts',
    'manifest.json',
    'README.md',
    'LICENSE',
  ].map((f) => `dist/${f}`);

  const pkgRaw = await fs.readFile(pkgPath, 'utf8');
  const pkgJson = JSON.parse(pkgRaw);
  pkgJson.files = files;
  await fs.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), 'utf8');
  console.log('📝 Updated package.json files list');
}

async function buildAll() {
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

  await generateManifest(pkg.version);
  await updatePackageJson(pkg.version);
}

buildAll();
