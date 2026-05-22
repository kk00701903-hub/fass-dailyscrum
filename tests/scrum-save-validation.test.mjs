import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getScrumSaveValidationMessage,
  isScrumFormSavable,
} from "../src/lib/scrum-save-validation.ts";

const filled = {
  yesterday: "어제 한 일",
  today: "오늘 할 일",
  selectedTasks: ["FWK-215"],
};

describe("scrum-save-validation", () => {
  it("allows save when all fields filled", () => {
    assert.equal(isScrumFormSavable(filled), true);
    assert.equal(getScrumSaveValidationMessage(filled), null);
  });

  it("blocks save when tasks not selected but text filled", () => {
    const form = { ...filled, selectedTasks: [] };
    assert.equal(isScrumFormSavable(form), false);
    assert.match(getScrumSaveValidationMessage(form), /담당 이슈 클릭/);
  });

  it("blocks save when yesterday empty", () => {
    const form = { ...filled, yesterday: "  " };
    assert.equal(isScrumFormSavable(form), false);
    assert.match(getScrumSaveValidationMessage(form), /전일 성과/);
  });

  it("allows save without tasks when backlog has no selectable issues", () => {
    const form = { ...filled, selectedTasks: [] };
    assert.equal(isScrumFormSavable(form, { requireTaskSelection: false }), true);
    assert.equal(getScrumSaveValidationMessage(form, { requireTaskSelection: false }), null);
  });
});
