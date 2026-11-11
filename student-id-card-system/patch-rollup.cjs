const fs = require('fs');
const path = require('path');

const wasmDist = path.join(__dirname, 'node_modules', '@rollup', 'wasm-node', 'dist');
const rollupDist = path.join(__dirname, 'node_modules', 'rollup', 'dist');

if (fs.existsSync(wasmDist) && fs.existsSync(rollupDist)) {
  fs.cpSync(path.join(wasmDist, 'wasm-node'), path.join(rollupDist, 'wasm-node'), { recursive: true, force: true });
  fs.copyFileSync(path.join(wasmDist, 'native.js'), path.join(rollupDist, 'native.js'));
  console.log('Applied @rollup/wasm-node fallback');
}
