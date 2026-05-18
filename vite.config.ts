import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const requiredFirebaseEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProductionBuild = mode === 'production';

  if (isProductionBuild) {
    const missingKeys = requiredFirebaseEnvKeys.filter((key) => !env[key]);
    if (missingKeys.length > 0) {
      throw new Error(`Missing required environment variables for production build: ${missingKeys.join(', ')}`);
    }
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Vercel SPA routes require absolute asset paths to avoid nested-route 404s.
    base: env.VITE_APP_BASE || '/',
  };
});
