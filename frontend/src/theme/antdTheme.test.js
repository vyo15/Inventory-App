import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMS_BRAND_THEME, getAntdTheme } from "./antdTheme";

const cssText = fs.readFileSync(path.resolve("src/index.css"), "utf8");

const readCssToken = (name, scope = "light") => {
  const source = scope === "dark"
    ? cssText.slice(cssText.indexOf("html.dark"))
    : cssText.slice(0, cssText.indexOf("html.dark"));
  const match = source.match(new RegExp(`${name}:\\s*([^;]+);`));
  return match?.[1]?.trim();
};

describe("IMS Ant Design theme", () => {
  it("menjaga palette JS sinkron dengan CSS variable utama", () => {
    expect(IMS_BRAND_THEME.light.primary).toBe(readCssToken("--ims-color-primary"));
    expect(IMS_BRAND_THEME.light.brandGold).toBe(readCssToken("--ims-color-brand-gold"));
    expect(IMS_BRAND_THEME.light.success).toBe(readCssToken("--ims-color-success"));
    expect(IMS_BRAND_THEME.light.danger).toBe(readCssToken("--ims-color-danger"));
    expect(IMS_BRAND_THEME.dark.primary).toBe(readCssToken("--ims-color-primary", "dark"));
    expect(IMS_BRAND_THEME.dark.success).toBe(readCssToken("--ims-color-success", "dark"));
    expect(IMS_BRAND_THEME.dark.danger).toBe(readCssToken("--ims-color-danger", "dark"));
    expect(readCssToken("--ims-nav-active-marker", "dark")).toBe("var(--ims-color-brand-gold)");
    expect(readCssToken("--ims-dashboard-hero-text")).toBe("#FFFFFF");
  });

  it("memetakan semantic success dan error ke token Ant Design", () => {
    const light = getAntdTheme(false).token;
    const dark = getAntdTheme(true).token;

    expect(light.colorSuccess).toBe(IMS_BRAND_THEME.light.success);
    expect(light.colorError).toBe(IMS_BRAND_THEME.light.danger);
    expect(dark.colorSuccessBg).toBe(IMS_BRAND_THEME.dark.successSoft);
    expect(dark.colorErrorText).toBe(IMS_BRAND_THEME.dark.dangerText);
  });
});
