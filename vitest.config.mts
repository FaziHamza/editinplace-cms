import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The editor is a browser library — it reads localStorage, scans the DOM
    // and injects its own UI, so tests need a document to work against.
    environment: 'jsdom',
  },
});
