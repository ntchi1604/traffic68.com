import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, 'public', 'api_seo_traffic68.src.js');
const outputPath = path.join(__dirname, 'public', 'api_seo_traffic68.js');

const code = fs.readFileSync(inputPath, 'utf8');

const result = JavaScriptObfuscator.obfuscate(code, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  debugProtection: false,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  target: 'browser',
});

fs.writeFileSync(outputPath, result.getObfuscatedCode(), 'utf8');
console.log('Done! Size:', Math.round(fs.statSync(outputPath).size / 1024), 'KB');
