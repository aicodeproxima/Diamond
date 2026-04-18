// Bundle src/ → dist/index.mjs (ESM) and dist/index.cjs (CJS).
// React is marked external so consumers share their own copy.

import { build } from 'esbuild'
import { mkdirSync } from 'fs'

mkdirSync('dist', { recursive: true })

const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'neutral',
  target: ['es2020'],
  loader: { '.jsx': 'jsx' },
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  sourcemap: true,
  logLevel: 'info',
}

await Promise.all([
  build({ ...shared, format: 'esm', outfile: 'dist/index.mjs' }),
  build({ ...shared, format: 'cjs', outfile: 'dist/index.cjs' }),
])

console.log('✓ built dist/index.mjs and dist/index.cjs')
