// Regenerate ../fonts-embed.js from the woff files in ../fonts.
// Run: node scripts/embed-fonts.mjs
import { readFileSync, writeFileSync } from 'fs';
const b64 = f => readFileSync(new URL('../fonts/' + f, import.meta.url)).toString('base64');
const mod = `// fonts-embed.js
// Base64-embedded brand fonts (woff), bundled directly so /api/og needs NO
// runtime font fetch or fs access — works identically in edge and node, so the
// share image always renders with the real Playfair/DM Sans, never a fallback.
// Regenerate with: node scripts/embed-fonts.mjs
export const FONTS_B64 = {
  playfair700: "${b64('PlayfairDisplay-700.woff')}",
  dmsans400: "${b64('DMSans-400.woff')}",
  dmsans700: "${b64('DMSans-700.woff')}",
};
`;
writeFileSync(new URL('../fonts-embed.js', import.meta.url), mod);
console.log('wrote fonts-embed.js');
