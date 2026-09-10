import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'HeadNav — Hands-free Navigation',
    description: 'Navigate the web using only head and eye movements. An accessibility tool.',
    permissions: ['storage', 'offscreen'],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
});
