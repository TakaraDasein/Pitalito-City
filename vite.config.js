import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Los módulos de three/examples/jsm (GLTFLoader, SkeletonUtils) importan 'three' por su cuenta: sin esto Vite
  // puede resolver dos copias y avisa "Multiple instances of Three.js" (rompe instanceof y el skinning).
  resolve: { dedupe: ['three'] },
  optimizeDeps: { include: ['three'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  server: { host: true, port: 5173 },
});
