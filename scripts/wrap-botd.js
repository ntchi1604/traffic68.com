/**
 * Wrap @fingerprintjs/botd CJS build into IIFE for browser <script> tag usage.
 * Exposes window.Botd global with .load() method.
 * Also copies FingerprintJS UMD build to public/fp.js.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Wrap BotD CJS → IIFE with window.Botd global
const cjsPath = join(__dirname, '..', 'node_modules', '@fingerprintjs', 'botd', 'dist', 'botd.cjs.js');
const outPath = join(__dirname, '..', 'public', 'botd.js');

if (!existsSync(cjsPath)) {
  console.log('[wrap-botd] botd.cjs.js not found, skipping');
  process.exit(0);
}

const cjs = readFileSync(cjsPath, 'utf8');
const wrapped = `(function(){var module={exports:{}};var exports=module.exports;\n${cjs}\nwindow.Botd=module.exports;})();\n`;
writeFileSync(outPath, wrapped, 'utf8');
console.log('[wrap-botd] Created public/botd.js (' + wrapped.length + ' bytes)');

// Copy FingerprintJS UMD build
const fpSrc = join(__dirname, '..', 'node_modules', '@fingerprintjs', 'fingerprintjs', 'dist', 'fp.umd.min.js');
const fpOut = join(__dirname, '..', 'public', 'fp.js');
if (existsSync(fpSrc)) {
  copyFileSync(fpSrc, fpOut);
  console.log('[wrap-botd] Copied public/fp.js');
}
