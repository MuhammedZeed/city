import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const appDir = import.meta.dirname;

function resolvePackageDir(pkgName: string): string {
  return path.dirname(require.resolve(`${pkgName}/package.json`));
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(appDir, 'dist');
          const srcAssets = path.resolve(appDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@enginora/shared': path.resolve(appDir, '../../packages/shared/src/index.ts'),
        'react-dom': resolvePackageDir('react-dom'),
        react: resolvePackageDir('react'),
        'lucide-react': resolvePackageDir('lucide-react'),
        '@': path.resolve(appDir, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
