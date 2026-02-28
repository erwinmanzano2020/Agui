import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsPDF } from "jspdf";

import { fitTextToBox } from "@/lib/hr/employee-id-card-pdf";

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
