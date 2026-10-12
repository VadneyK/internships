// Home hero decoration: the splats and the swoosh have empty alt text, so they are decoration only.
// They must not compete with the text and the picker data for first load: decoding="async" and fetchpriority="low",
// width and height kept (no layout shift), never loading="eager". Home still has exactly three images.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

test("decorative (alt empty) images on Home load at low priority with no layout shift", async () => {
  const { dom, document } = await loadPage("index.html");
  try {
    const imgs = [...document.querySelectorAll("img")];
    assert.equal(imgs.length, 3, "Home should have exactly three img elements");

    const decor = imgs.filter((img) => img.getAttribute("alt") === "");
    assert.ok(decor.length > 0, "Home should have decorative images with alt=\"\"");

    for (const img of decor) {
      const name = img.getAttribute("src");
      assert.equal(img.getAttribute("decoding"), "async", `${name} needs decoding="async"`);
      assert.equal(img.getAttribute("fetchpriority"), "low", `${name} needs fetchpriority="low"`);
      assert.ok(img.hasAttribute("width"), `${name} needs a width attribute`);
      assert.ok(img.hasAttribute("height"), `${name} needs a height attribute`);
      assert.notEqual(img.getAttribute("loading"), "eager", `${name} must not be loading="eager"`);
    }
  } finally {
    dom.window.close();
  }
});
