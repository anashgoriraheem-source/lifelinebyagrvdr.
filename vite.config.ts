// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Base44 sandbox only (BASE44_PREVIEW_MODE=1): serve on port 3000 and accept the
// preview proxy's hostnames, which rotate with the sandbox. With the flag unset
// the original defaults (port 8080, no extra allowed hosts) are kept.
const previewMode = process.env.BASE44_PREVIEW_MODE === "1";
const previewSuffix = process.env.BASE44_PUBLIC_HOST_SUFFIX;
const sandboxHostDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN;

const previewServer =
  previewMode && previewSuffix
    ? {
        port: 3000,
        strictPort: true,
        host: true,
        allowedHosts: [
          `3000-${previewSuffix}`,
          ...(sandboxHostDomain ? [`.${sandboxHostDomain}`] : []),
        ],
      }
    : undefined;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(previewServer ? { vite: { server: previewServer } } : {}),
});
