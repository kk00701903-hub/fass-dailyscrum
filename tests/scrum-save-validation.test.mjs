import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canEditScrumTextFields,
  getScrumSaveValidationMessage,
  isScrumFormSavable,
} from "../src/lib/scrum-save-validation.ts";

const filled = {
  yesterdayByTask: { "FWK-215": "어제 한 일", "FWK-217": "어제 B" },
  todayByTask: { "FWK-215": "오늘 할 일", "FWK-217": "오늘 B" },
  selectedTasks: ["FWK-215", "FWK-217"],
};

describe("scrum-save-validation", () => {
  it("allows save when all selected tasks have yesterday and today", () => {
    assert.equal(isScrumFormSavable(filled), true);
    assert.equal(getScrumSaveValidationMessage(filled), null);
  });

  it("blocks save when tasks not selected but text filled", () => {
    const form = { ...filled, selectedTasks: [] };
    assert.equal(isScrumFormSavable(form), false);
    assert.match(getScrumSaveValidationMessage(form), /담당 이슈 클릭/);
  });

  it("blocks save when one task missing yesterday", () => {
    const form = {
      ...filled,
      yesterdayByTask: { "FWK-215": "ok", "FWK-217": "  " },
    };
    assert.equal(isScrumFormSavable(form), false);
    assert.match(getScrumSaveValidationMessage(form), /전일 성과/);
  });

  it("blocks save when one task missing today", () => {
    const form = {
      ...filled,
      todayByTask: { "FWK-215": "ok", "FWK-217": "" },
    };
    assert.equal(isScrumFormSavable(form), false);
    assert.match(getScrumSaveValidationMessage(form), /오늘 계획/);
  });

  it("allows save without tasks when backlog has no selectable issues", () => {
    const form = {
      yesterdayByTask: { _free: "어제" },
      todayByTask: { _free: "오늘" },
      selectedTasks: [],
    };
    assert.equal(isScrumFormSavable(form, { requireTaskSelection: false }), true);
    assert.equal(getScrumSaveValidationMessage(form, { requireTaskSelection: false }), null);
  });
});

describe("canEditScrumTextFields", () => {
  it("blocks text when selectable issues exist but none selected", () => {
    assert.equal(
      canEditScrumTextFields({ hasSelectableTasks: true, selectedTaskCount: 0 }),
      false
    );
  });

  it("allows text when at least one issue selected", () => {
    assert.equal(
      canEditScrumTextFields({ hasSelectableTasks: true, selectedTaskCount: 1 }),
      true
    );
  });

  it("allows text when no selectable issues (TODO only / empty panel)", () => {
    assert.equal(
      canEditScrumTextFields({ hasSelectableTasks: false, selectedTaskCount: 0 }),
      true
    );
  });
});
