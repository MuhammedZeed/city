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

function collectWorkspaceTextFiles(workspaceRoot: string): Record<string, string> {
  const result: Record<string, string> = {};
  const textExts = new Set(['.ts', '.tsx', '.css', '.json', '.html', '.md', '.txt', '.example']);

  const walk = (absDir: string, relPrefix: string) => {
    if (!fs.existsSync(absDir)) return;
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'images') {
        continue;
      }
      const absEntry = path.join(absDir, entry.name);
      const relEntry = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(absEntry, relEntry);
      } else if (
        entry.isFile() &&
        (textExts.has(path.extname(entry.name).toLowerCase()) ||
          entry.name.startsWith('.env') ||
          entry.name === '.gitignore')
      ) {
        result[relEntry] = fs.readFileSync(absEntry, 'utf8');
      }
    }
  };

  walk(path.join(workspaceRoot, 'apps/game'), 'apps/game');
  walk(path.join(workspaceRoot, 'apps/admin'), 'apps/admin');
  walk(path.join(workspaceRoot, 'packages/shared'), 'packages/shared');
  return result;
}

function listGameImages(workspaceRoot: string): string[] {
  const imgDir = path.join(workspaceRoot, 'apps/game/src/assets/images');
  if (!fs.existsSync(imgDir)) return [];
  return fs
    .readdirSync(imgDir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(png|jpe?g|webp|svg)$/i.test(e.name))
    .map((e) => e.name)
    .sort();
}

function readOptionalText(absPath: string): string {
  if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
    return fs.readFileSync(absPath, 'utf8');
  }
  return '';
}

export default defineConfig(() => {
  const virtualVaultId = 'virtual:founder-source-vault';
  const resolvedVirtualVaultId = '\0' + virtualVaultId;
  const workspaceRoot = path.resolve(appDir, '../..');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'founder-source-vault',
        resolveId(id: string) {
          if (id === virtualVaultId) {
            return resolvedVirtualVaultId;
          }
          return undefined;
        },
        load(id: string) {
          if (id !== resolvedVirtualVaultId) return undefined;
          const payload = {
            textFiles: collectWorkspaceTextFiles(workspaceRoot),
            imageFiles: listGameImages(workspaceRoot),
            baseGddText: readOptionalText(path.join(appDir, 'docs/11_13e76863.txt')),
            marketAddendumText: readOptionalText(path.join(appDir, 'docs/2_ab67c4eb.txt')),
            generatedAt: new Date().toISOString(),
          };
          return `export default ${JSON.stringify(payload)};`;
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
