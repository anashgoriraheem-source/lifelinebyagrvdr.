> **RC1 review build (2026-11-02): not approved for public/commercial release.** Read [RELEASE_CANDIDATE.md](./RELEASE_CANDIDATE.md) for implementation, evidence and go-live gates. Use the npm lockfile for this candidate; older setup/roadmap statements below are historical. No app was deployed during this review.

# Lifeline

Emergency-support and medical-literacy web app: SOS actions, consent-based
emergency contact workflows, phone motion monitoring while the page is open,
location sharing when chosen, and offline first-aid guidance. Lifeline does not
measure physiological readings or connect to smartwatches. Calls and messages
are subject to the user's settings and platform/provider availability; delivery
is never guaranteed. Sensor capabilities and limits are documented in
[docs/device-support.md](./docs/device-support.md).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lifelinebyagrvdr.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2183ada4-af48-4ee5-b473-dfcfb53c612f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
