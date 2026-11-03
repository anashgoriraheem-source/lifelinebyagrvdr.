// Network doubles below are transport fixtures, never product/demo responses.
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const response = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
let adapter: typeof import("./translate.server");
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("TRANSLATE_API_URL", "");
  vi.stubEnv("TRANSLATE_API_KEY", "");
  adapter = await import("./translate.server");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Real translation transport boundary with mocked network only", () => {
  it("reports missing configuration honestly without a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(adapter.translationConfigured()).toBe(false);
    expect(
      (await adapter.translate("Keep the device close and switched on.", "en", "hi")).status,
    ).toBe("unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never treats AI keys as translation-provider configuration", () => {
    vi.stubEnv("AI_API_KEY", "synthetic-test-only");
    expect(adapter.translationConfigured()).toBe(false);
  });
  it("blocks arbitrary personal information before any provider request", async () => {
    vi.stubEnv("TRANSLATE_API_URL", "https://translation.example.invalid");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (await adapter.translate("My glucose is 40 and phone is +919999999999", "en", "hi")).status,
    ).toBe("error");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects unsupported languages before a provider call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await adapter.translate("You can continue without a device.", "en", "zz")).status).toBe(
      "error",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    "http://translation.example.invalid",
    "https://user:pass@example.invalid",
    "https://example.invalid/?key=secret",
  ])("rejects insecure or credential-bearing provider URL %s", (url) => {
    vi.stubEnv("TRANSLATE_API_URL", url);
    expect(adapter.translationConfigured()).toBe(false);
  });
  it("calls actual language-list and translate paths with server-side credentials", async () => {
    vi.stubEnv("TRANSLATE_API_URL", "https://translation.example.invalid");
    vi.stubEnv("TRANSLATE_API_KEY", "synthetic-test-only");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response([
          { code: "en", name: "English", targets: ["hi"] },
          { code: "hi", name: "Hindi", targets: ["en"] },
        ]),
      )
      .mockResolvedValueOnce(response({ translatedText: "network-fixture-output" }));
    vi.stubGlobal("fetch", fetch);
    const result = await adapter.translate("You can continue without a device.", "en", "hi");
    expect(result.status).toBe("ok");
    expect(result.translatedText).toBe("network-fixture-output");
    expect(fetch.mock.calls[0][0]).toBe("https://translation.example.invalid/languages");
    expect(fetch.mock.calls[1][0]).toBe("https://translation.example.invalid/translate");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      q: "You can continue without a device.",
      source: "en",
      target: "hi",
      api_key: "synthetic-test-only",
    });
    expect(fetch.mock.calls[1][1].signal).toBeDefined();
    expect(fetch.mock.calls[1][1].redirect).toBe("error");
    expect(JSON.stringify(result)).not.toContain("synthetic-test-only");
  });
  it("does not infer Hindi support when provider language list excludes it", async () => {
    vi.stubEnv("TRANSLATE_API_URL", "https://translation.example.invalid");
    const fetch = vi.fn().mockResolvedValue(response([{ code: "en", name: "English" }]));
    vi.stubGlobal("fetch", fetch);
    expect((await adapter.translate("You can continue without a device.", "en", "hi")).status).toBe(
      "error",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("reports timeout/catalogue failure, never mock output or model fallback", async () => {
    vi.stubEnv("TRANSLATE_API_URL", "https://translation.example.invalid");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Test timeout", "TimeoutError")),
    );
    const result = await adapter.translate("You can continue without a device.", "en", "hi");
    expect(result.status).toBe("error");
    expect(result.translatedText).toBeUndefined();
  });
  it("rejects malformed translation replies", async () => {
    vi.stubEnv("TRANSLATE_API_URL", "https://translation.example.invalid");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response([
            { code: "en", name: "English", targets: ["hi"] },
            { code: "hi", name: "Hindi", targets: ["en"] },
          ]),
        )
        .mockResolvedValueOnce(response({ translatedText: 42 })),
    );
    const result = await adapter.translate("You can continue without a device.", "en", "hi");
    expect(result.status).toBe("error");
    expect(result.translatedText).toBeUndefined();
  });
  it("does not expose provider bodies on a non-success response", async () => {
    vi.stubEnv("TRANSLATE_API_URL", "https://translation.example.invalid");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ error: "provider-secret-body" }, 500)),
    );
    const result = await adapter.translate("You can continue without a device.", "en", "hi");
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("provider-secret-body");
  });
});
