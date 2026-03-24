import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FieldError, MutationMessage, SubmitButtonView } from "../DtrSegmentForms";

describe("DTR form UI helpers", () => {
  it("renders field-level validation errors", () => {
    const html = renderToStaticMarkup(React.createElement(FieldError, { message: ["Invalid time in"] }));
    assert.match(html, /Invalid time in/);
  });

  it("renders global error and success messages", () => {
    const errorHtml = renderToStaticMarkup(
      React.createElement(MutationMessage, {
        status: "error",
        message: "Authentication required.",
        formError: ["Request context is missing or invalid. Refresh and try again."],
      }),
    );
    assert.match(errorHtml, /Authentication required\./);
    assert.match(errorHtml, /Request context is missing or invalid/);

    const successHtml = renderToStaticMarkup(
      React.createElement(MutationMessage, { status: "success", message: "DTR segment saved." }),
    );
    assert.match(successHtml, /DTR segment saved\./);
  });

  it("renders pending submit state as disabled with pending label", () => {
    const html = renderToStaticMarkup(
      React.createElement(SubmitButtonView, {
        label: "Save",
        pendingLabel: "Saving…",
        pending: true,
        className: "btn",
      }),
    );

    assert.match(html, /Saving…/);
    assert.match(html, /disabled/);
  });
});
