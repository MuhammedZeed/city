import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function collectProjectTextFiles(rootDir: string): Record<string, string> {
  const result: Record<string, string> = {};
  const rootFiles = [
    'index.html',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'metadata.json',
    '.env.example',
    '.gitignore',
  ];

  for (const rel of rootFiles) {
    const abs = path.resolve(rootDir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      result[rel] = fs.readFileSync(abs, 'utf8');
    }
  }

  const textExts = new Set(['.ts', '.tsx', '.css', '.json', '.md', '.txt']);
  const walkSrc = (absDir: string, relPrefix: string) => {
    if (!fs.existsSync(absDir)) return;
    const entries = fs.readdirSync(absDir, {withFileTypes: true});
    for (const entry of entries) {
      const absEntry = path.join(absDir, entry.name);
      const relEntry = `${relPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === 'images') continue;
        walkSrc(absEntry, relEntry);
      } else if (entry.isFile() && textExts.has(path.extname(entry.name).toLowerCase())) {
        result[relEntry] = fs.readFileSync(absEntry, 'utf8');
      }
    }
  };

  walkSrc(path.resolve(rootDir, 'src'), 'src');
  return result;
}

function listProjectImages(rootDir: string): string[] {
  const imgDir = path.resolve(rootDir, 'src/assets/images');
  if (!fs.existsSync(imgDir)) return [];
  return fs
    .readdirSync(imgDir, {withFileTypes: true})
    .filter((e) => e.isFile() && /\.(png|jpe?g|webp|svg)$/i.test(e.name))
    .map((e) => e.name)
    .sort();
}

function readOptionalText(rootDir: string, relPath: string): string {
  const abs = path.resolve(rootDir, relPath);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    return fs.readFileSync(abs, 'utf8');
  }
  return '';
}

export default defineConfig(() => {
  const virtualVaultId = 'virtual:founder-source-vault';
  const resolvedVirtualVaultId = '\0' + virtualVaultId;

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
          const rootDir = __dirname;
          const payload = {
            textFiles: collectProjectTextFiles(rootDir),
            imageFiles: listProjectImages(rootDir),
            baseGddText: readOptionalText(rootDir, 'public/assets/aistudio/11_13e76863.txt'),
            marketAddendumText: readOptionalText(rootDir, 'public/assets/aistudio/2_ab67c4eb.txt'),
            generatedAt: new Date().toISOString(),
          };
          return `export default ${JSON.stringify(payload)};`;
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
