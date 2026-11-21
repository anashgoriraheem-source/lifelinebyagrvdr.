/* Run against a LOCAL server only: npm run dev -- --host 127.0.0.1
 * Synthetic motion traces, never real devices or emergency actions.
 * Output is evidence from this run, NOT WCAG or clinical certification. */
const { chromium } = require("@playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.RELEASE_TEST_URL || "http://127.0.0.1:8080";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Refusing non-local test target");
const out = path.join(process.cwd(), "release-evidence");
fs.mkdirSync(out, { recursive: true });
const evidence = {
  browser: null,
  platform: process.platform,
  hardware: "None; synthetic motion traces only",
  matrix: [],
  journeys: [],
  errors: [],
  externalRequests: [],
  limitations: [
    "No NVDA, JAWS, VoiceOver or TalkBack testing",
    "No physical motion-sensor hardware",
    "No live provider or backend testing",
  ],
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  evidence.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === "http:" && u.hostname === "127.0.0.1") return route.continue();
    if (u.protocol === "https:" || u.protocol === "http:") {
      evidence.externalRequests.push(u.origin);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  const go = async (p) => {
    await page.goto(base + p, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ timeout: 45000 });
    await page.waitForTimeout(300);
  };
  const step = async (name, fn) => {
    try {
      await fn();
      evidence.journeys.push({ name, result: "passed" });
    } catch (e) {
      evidence.journeys.push({ name, result: "failed", error: e.message });
    }
  };
  await step("Emergency page keeps SOS available and states motion-monitor limits", async () => {
    await go("/monitor");
    assert(
      await page.getByRole("button", { name: "Open emergency options", exact: true }).isVisible(),
    );
    assert.match(await page.locator("main").innerText(), /phone motion sensor|motion sensor/i);
    assert.match(await page.locator("main").innerText(), /nothing runs in the background/i);
    assert.doesNotMatch(
      await page.locator("main").innerText(),
      /heart rate|blood oxygen|blood pressure/i,
    );
  });
  await step("Synthetic motion tests never open an alarm or contact anyone", async () => {
    await go("/monitor");
    await page.getByRole("button", { name: "60 s lying still", exact: true }).click();
    await page.getByText("Test: 60 s lying still", { exact: true }).waitFor();
    assert.match(await page.locator("main").innerText(), /Test only — nothing was sent or called/);
    assert.equal(await page.getByRole("dialog").count(), 0);
  });
  await step(
    "Keyboard opens emergency dialog; focus is contained; drafts exclude private data by default",
    async () => {
      await go("/");
      const button = page.getByRole("button", { name: "Open emergency options", exact: true });
      await button.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.equal(await dialog.locator("input[type=checkbox]:checked").count(), 0);
      assert.match(await dialog.innerText(), /No call or message has been sent/);
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press("Tab");
        assert(await page.evaluate(() => !!document.activeElement.closest("[role=dialog]")));
      }
      const link = dialog.getByRole("link", { name: "Open phone to call 112" });
      assert.equal(await link.getAttribute("href"), "tel:112");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(() =>
        document.activeElement?.textContent.includes("Open emergency options"),
      );
    },
  );
  await step(
    "Missing translation provider stays unavailable; public-phrase consent required",
    async () => {
      await go("/translate");
      await page.getByText("Online translation is unavailable.", { exact: false }).waitFor();
      assert(await page.getByRole("button", { name: "Translate", exact: true }).isDisabled());
      assert.equal(await page.locator("textarea").count(), 0);
    },
  );
  await step(
    "Local first aid works with provider requests blocked; urgent text does not wait for chat",
    async () => {
      await go("/assistant");
      await page
        .getByLabel("Ask about first aid, emergency preparedness or what to do next", {
          exact: false,
        })
        .fill("crushing chest pain");
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      await page.locator("[role=alert]").waitFor();
      assert.match(
        await page.locator("[role=alert]").innerText(),
        /contact local emergency services now/,
      );
      assert.equal(await page.locator("[role=alert]").count(), 1);
    },
  );
  await step("Language selection persists and changes document language", async () => {
    await go("/monitor");
    await page.getByLabel("App language", { exact: true }).first().selectOption("hi");
    await page.waitForFunction(() => document.documentElement.lang === "hi-IN");
    await page.reload();
    await page.waitForFunction(() => document.documentElement.lang === "hi-IN");
    assert.match(await page.locator("main").innerText(), /गति और गिरने के संकेत/);
  });
  await step("Skip link receives keyboard focus and reaches main", async () => {
    await go("/");
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute("href")),
      "#main-content",
    );
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "main-content");
  });
  await step("200% text resizing reflows monitor at 390px", async () => {
    await go("/monitor");
    await page.addStyleTag({ content: "html{font-size:200%!important}" });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  });
  for (const width of [320, 390, 768, 1280])
    for (const locale of ["en", "hi"])
      for (const route of [
        "/",
        "/monitor",
        "/contacts",
        "/account",
        "/assistant",
        "/terms",
        "/translate",
        "/saath",
      ]) {
        await page.setViewportSize({ width, height: 900 });
        await go(route);
        const select = page.locator("header select").first();
        await select.selectOption(locale);
        await page.waitForFunction(
          (l) => document.documentElement.lang === l,
          locale === "hi" ? "hi-IN" : "en-IN",
        );
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        const scan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        evidence.matrix.push({
          route,
          width,
          locale,
          overflow,
          violations: scan.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
        });
      }
  await page.setViewportSize({ width: 390, height: 844 });
  await go("/monitor");
  await page.locator("header select").first().selectOption("hi");
  await page.screenshot({ path: path.join(out, "monitor-hi-390.png"), fullPage: true });
  await step("Offline page saves public content only and reopens without network", async () => {
    await go("/offline.html");
    await page.waitForFunction(
      () =>
        document.querySelector("#save-state")?.textContent.includes("saved on this device") ||
        document.querySelector("#save-state")?.textContent.includes("सहेजा गया"),
      { timeout: 15000 },
    );
    const keys = await page.evaluate(async () => {
      const c = await caches.open("lifeline-public-offline-rc1");
      return (await c.keys()).map((r) => new URL(r.url).pathname);
    });
    assert.deepEqual(keys, ["/offline.html"]);
    await context.setOffline(true);
    await page.reload();
    await page.locator("main details").first().waitFor();
    assert.equal(await page.locator("main details").count(), 18);
    await page.locator("#language").selectOption("hi");
    assert.equal(await page.locator("html").getAttribute("lang"), "hi-IN");
    await context.setOffline(false);
  });
  fs.writeFileSync(path.join(out, "browser-checks.json"), JSON.stringify(evidence, null, 2));
  const summary = {
    browser: evidence.browser,
    matrix: evidence.matrix.length,
    overflow: evidence.matrix.filter((r) => r.overflow).length,
    axeViolationCases: evidence.matrix.filter((r) => r.violations.length).length,
    journeys: evidence.journeys,
    errors: evidence.errors,
    externalRequests: evidence.externalRequests,
  };
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  if (
    summary.overflow ||
    summary.axeViolationCases ||
    evidence.journeys.some((r) => r.result === "failed") ||
    evidence.errors.length
  )
    process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  fs.writeFileSync(
    path.join(out, "browser-checks-partial.json"),
    JSON.stringify(evidence, null, 2),
  );
  process.exitCode = 1;
});
