import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { jsPDF } from "jspdf";

import { fitTextToBox, getHeaderBrandName, resolveHouseLogo } from "@/lib/hr/employee-id-card-pdf";

afterEach(() => {
  mock.restoreAll();
});

describe("fitTextToBox", () => {
  it("fits long names into two lines with a floor font size", () => {
    const doc = new jsPDF({ unit: "mm", format: [53.98, 85.6], orientation: "landscape" });

    const result = fitTextToBox(doc, {
      text: "Edward Jonathan Dela Cruz Manzano Jr.",
      maxWidth: 34,
      maxLines: 2,
      startFontSize: 11,
      minFontSize: 8,
    });

    assert.ok(result.lines.length <= 2);
    assert.ok(result.fontSize <= 11);
    assert.ok(result.fontSize >= 8);
  });

  it("clamps with ellipsis when text cannot fit", () => {
    const doc = new jsPDF({ unit: "mm", format: [53.98, 85.6], orientation: "landscape" });

    const result = fitTextToBox(doc, {
      text: "Procurement and Logistics Manager for Regional Operations",
      maxWidth: 8,
      maxLines: 1,
      startFontSize: 8,
      minFontSize: 7,
    });

    assert.equal(result.lines.length, 1);
    assert.match(result.lines[0], /…$/);
  });
});

describe("header branding fallback", () => {
  it("returns null when house name is missing and never returns Store/House fallback text", () => {
    assert.equal(getHeaderBrandName("", ""), null);
    assert.equal(getHeaderBrandName("   ", ""), null);
    assert.equal(getHeaderBrandName(null, null), null);
    assert.notEqual(getHeaderBrandName("", ""), "Store");
    assert.notEqual(getHeaderBrandName("", ""), "House");
  });

  it("uses brand name when present", () => {
    assert.equal(getHeaderBrandName("Demo Brand", "Demo House"), "Demo Brand");
  });

  it("falls back to house name when brand is empty", () => {
    assert.equal(getHeaderBrandName(null, "Demo House"), "Demo House");
  });
});

describe("resolveHouseLogo", () => {
  it("returns null for unsupported logo content types", async () => {
    mock.method(globalThis, "fetch", async () =>
      new Response("<svg></svg>", {
        status: 200,
        headers: { "content-type": "image/svg+xml" },
      }),
    );

    const result = await resolveHouseLogo("https://example.com/logo.svg", new Map());
    assert.equal(result, null);
  });

  it("skips logo when logo fetch fails", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new Error("network fail");
    });

    const result = await resolveHouseLogo("https://example.com/logo.png", new Map());
    assert.equal(result, null);
  });

});
