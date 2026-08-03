import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const webPkg = path.resolve(root, '../packages/saPvtLtdWebPackages');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Linked package must share the app's React / antd (avoids invalid hook call)
    dedupe: ['react', 'react-dom', 'antd'],
    alias: [
      {
        find: 'react',
        replacement: path.resolve(root, 'node_modules/react'),
      },
      {
        find: 'react-dom',
        replacement: path.resolve(root, 'node_modules/react-dom'),
      },
      {
        find: 'antd',
        replacement: path.resolve(root, 'node_modules/antd'),
      },
      // Specific subpath first — do not collapse styles.css into index.js
      {
        find: 'sapvt-ltd-web-packages/styles.css',
        replacement: path.join(webPkg, 'dist/styles.css'),
      },
      {
        find: /^sapvt-ltd-web-packages$/,
        replacement: path.join(webPkg, 'dist/index.js'),
      },
    ],
  },
  optimizeDeps: {
    // Do not prebundle the local package — filterType / Icon updates must be live
    exclude: ['sapvt-ltd-web-packages'],
    include: ['antd'],
  },
  server: {
    fs: {
      allow: ['..'],
    },
    watch: {
      ignored: ['!**/packages/saPvtLtdWebPackages/dist/**'],
    },
  },
});
