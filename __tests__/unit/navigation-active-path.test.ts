import { describe, expect, it } from "vitest";

import { isActivePath } from "@/components/navigation/navigation";

describe("isActivePath", () => {
  it.each([
    ["/teaDay", "/teaDay"],
    ["/editions", "/editions"],
    ["/", "/"],
  ])("is active when %s is exactly %s", (pathname, href) => {
    expect(isActivePath(pathname, href)).toBe(true);
  });

  it.each([
    ["/teaDay/abc123", "/teaDay"],
    ["/editions/2026", "/editions"],
    ["/ranking/abc", "/ranking"],
  ])("is active when %s is below %s", (pathname, href) => {
    expect(isActivePath(pathname, href)).toBe(true);
  });

  it("is not active for a prefix that does not end at a segment boundary", () => {
    expect(isActivePath("/teaDayX", "/teaDay")).toBe(false);
  });

  it("is not active on a parent of the item", () => {
    expect(isActivePath("/editions", "/editions/2026")).toBe(false);
  });

  it("is not active on an unrelated section", () => {
    expect(isActivePath("/users", "/editions")).toBe(false);
  });

  it("keeps the home item active only on the root itself", () => {
    expect(isActivePath("/teaDay", "/")).toBe(false);
  });
});
