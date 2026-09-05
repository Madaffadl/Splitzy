// @vitest-environment happy-dom
/**
 * The star rating is a form control, not decoration, and it is built on native
 * radios specifically so keyboard and screen-reader behaviour come from the
 * browser rather than from handlers we maintain. These tests pin the
 * properties that would silently undo that.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { StarRatingInput } from "./StarRatingInput";

afterEach(cleanup);

const LABELS: [string, string, string, string, string] = [
  "1 out of 5 stars",
  "2 out of 5 stars",
  "3 out of 5 stars",
  "4 out of 5 stars",
  "5 out of 5 stars",
];

function setup(value = 0, onChange = vi.fn()) {
  render(
    <StarRatingInput
      value={value}
      onChange={onChange}
      label="How would you rate Splitzy?"
      starLabels={LABELS}
    />
  );
  return { onChange };
}

describe("StarRatingInput", () => {
  it("renders five real radio inputs", () => {
    setup();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("checks the radio matching the current value", () => {
    setup(4);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.checked)).toEqual([false, false, false, true, false]);
  });

  it("reports the chosen number, not an index", () => {
    const { onChange } = setup(0);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    radios[2].click();
    expect(onChange).toHaveBeenCalledWith(3);
  });

  // The inputs are visually hidden. If that were ever done with `display:none`
  // or the `hidden` attribute they would leave the tab order and the a11y tree,
  // which is the whole reason native radios were chosen over a div widget.
  it("hides the inputs with sr-only, keeping them focusable", () => {
    setup(3);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.className).toContain("sr-only");
      expect(radio.className).not.toContain("hidden");
      expect(radio.hasAttribute("hidden")).toBe(false);
    }
  });

  it("groups the radios under one name so they behave as a single control", () => {
    setup();
    const names = new Set(
      (screen.getAllByRole("radio") as HTMLInputElement[]).map((r) => r.name)
    );
    expect(names.size).toBe(1);
  });

  it("gives every star an accessible name", () => {
    setup();
    for (const label of LABELS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("disables every radio when the control is disabled", () => {
    render(
      <StarRatingInput
        value={2}
        onChange={vi.fn()}
        label="rate"
        starLabels={LABELS}
        disabled
      />
    );
    for (const radio of screen.getAllByRole("radio") as HTMLInputElement[]) {
      expect(radio.disabled).toBe(true);
    }
  });
});
