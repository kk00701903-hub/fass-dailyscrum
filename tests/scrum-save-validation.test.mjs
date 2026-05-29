import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canEditScrumTextFields,
  getScrumSaveValidationMessage,
  isScrumFormSavable,
} from "../src/lib/scrum-save-validation.ts";

// 1개 선택 — 정상 케이스
const filledOne = {
  yesterdayByTask: { "FWK-215": "어제 한 일" },
  todayByTask: { "FWK-215": "오늘 할 일" },
  selectedTasks: ["FWK-215"],
};

// 2개 선택 — 조회 전용 케이스
const filledTwo = {
  yesterdayByTask: { "FWK-215": "어제 한 일", "FWK-217": "어제 B" },
  todayByTask: { "FWK-215": "오늘 할 일", "FWK-217": "오늘 B" },
  selectedTasks: ["FWK-215", "FWK-217"],
};

describe("scrum-save-validation", () => {
  it("allows save when exactly one task selected with both fields filled", () => {
    assert.equal(isScrumFormSavable(filledOne), true);
    assert.equal(getScrumSaveValidationMessage(filledOne), null);
  });

  it("blocks save when 2+ tasks selected (조회 전용)", () => {
    assert.equal(isScrumFormSavable(filledTwo), false);
    const msg = getScrumSaveValidationMessage(filledTwo);
    assert.ok(msg !== null, "should return error message");
    assert.match(msg, /1개만 선택/);
  });

  it("blocks save when tasks not selected but text filled", () => {
    const form = { ...filledOne, selectedTasks: [] };
    assert.equal(isScrumFormSavable(form), false);
    assert.match(getScrumSaveValidationMessage(form), /담당 이슈/);
  });

  it("blocks save when selected task missing yesterday", () => {
    const form = {
      ...filledOne,
      yesterdayByTask: { "FWK-215": "  " },
    };
    assert.equal(isScrumFormSavable(form), false);
    assert.match(getScrumSaveValidationMessage(form), /전일 성과/);
  });

  it("blocks save when selected task missing today", () => {
    const form = {
      ...filledOne,
      todayByTask: { "FWK-215": "" },
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

  it("allows text when exactly one issue selected", () => {
    assert.equal(
      canEditScrumTextFields({ hasSelectableTasks: true, selectedTaskCount: 1 }),
      true
    );
  });

  it("blocks text when 2+ issues selected (조회 전용)", () => {
    assert.equal(
      canEditScrumTextFields({ hasSelectableTasks: true, selectedTaskCount: 2 }),
      false
    );
  });

  it("allows text when no selectable issues (TODO only / empty panel)", () => {
    assert.equal(
      canEditScrumTextFields({ hasSelectableTasks: false, selectedTaskCount: 0 }),
      true
    );
  });
});
