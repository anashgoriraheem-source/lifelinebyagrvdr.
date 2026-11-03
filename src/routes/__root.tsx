import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { Nav } from "@/components/Nav";
import { AlarmOverlay } from "@/components/AlarmOverlay";
import { RuntimeNotices } from "@/components/RuntimeNotices";
import { VitalsEngine } from "@/components/VitalsEngine";
import { AccountSync } from "@/components/AccountSync";

import { I18nProvider } from "@/i18n";

const siteName = "Lifeline — personal safety and first aid";
const siteDescription =
  "Lifeline displays readings from compatible Bluetooth health devices and helps you prepare emergency calls, location messages and first-aid guidance.";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#101114" },
      { title: siteName },
      { name: "description", content: siteDescription },
      { property: "og:title", content: siteName },
      { property: "og:description", content: siteDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen">
        <I18nProvider>
          <VitalsEngine />
          <AccountSync />

          <Nav />
          {children}
          <RuntimeNotices />
          <AlarmOverlay />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
