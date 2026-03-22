import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  { src: 'public/api_seo_traffic68.src.js', out: 'public/api_seo_traffic68.js' },
];

const options = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  debugProtection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

for (const f of files) {
  const srcPath = path.join(__dirname, '..', f.src);
  const outPath = path.join(__dirname, '..', f.out);
  const code = fs.readFileSync(srcPath, 'utf8');
  console.log(`Obfuscating ${f.src} (${(code.length / 1024).toFixed(1)}KB)...`);
  const result = JavaScriptObfuscator.obfuscate(code, options);
  fs.writeFileSync(outPath, result.getObfuscatedCode());
  const outSize = fs.statSync(outPath).size;
  console.log(`  → ${f.out} (${(outSize / 1024).toFixed(1)}KB)`);
}

console.log('Done!');
