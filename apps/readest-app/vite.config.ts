import path from 'node:path';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const storyBoredRoot = path.resolve('../../..');

export default defineConfig({
  plugins: [vinext()],
  resolve: {
    alias: {
      '@pdfjs': path.resolve('public/vendor/pdfjs'),
      '@simplecc': path.resolve('public/vendor/simplecc'),
      '@storybored/storybored-sdk': path.join(
        storyBoredRoot,
        'packages/storybored-sdk/src/index.ts',
      ),
      '@storybored/types': path.join(storyBoredRoot, 'packages/types/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.message?.includes("Can't resolve original location of error")) return;
        defaultHandler(warning);
      },
    },
  },
  ssr: {
    noExternal: ['tinycolor2'],
  },
});
