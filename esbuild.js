// @ts-check
const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  outfile: 'out/extension.js',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
};

/** @type {esbuild.BuildOptions} */
const webviewConfig = {
  entryPoints: ['src/webview/app/index.tsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  outfile: 'out/webview.js',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
};

async function build() {
  if (isWatch) {
    const [extCtx, webCtx] = await Promise.all([
      esbuild.context(extensionConfig),
      esbuild.context(webviewConfig),
    ]);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log('[esbuild] Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    console.log('[esbuild] Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
