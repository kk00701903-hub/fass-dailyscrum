import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskLogRows,
  parseLegacyTaskTexts,
  pruneTaskTextMap,
  serializeTaskTexts,
  taskLogsToMaps,
} from "../src/lib/scrum-task-fields.ts";

describe("scrum-task-fields", () => {
  it("pruneTaskTextMap keeps only selected keys", () => {
    const pruned = pruneTaskTextMap(
      { "FWK-215": "a", "FWK-217": "b", "FWK-999": "x" },
      ["FWK-215", "FWK-217"]
    );
    assert.deepEqual(pruned, { "FWK-215": "a", "FWK-217": "b" });
  });

  it("serialize and parse round-trip per issue key", () => {
    const map = { "FWK-215": "전일 A", "FWK-217": "전일 B" };
    const keys = ["FWK-215", "FWK-217"];
    const text = serializeTaskTexts(map, keys);
    const parsed = parseLegacyTaskTexts(text, keys);
    assert.equal(parsed["FWK-215"], "전일 A");
    assert.equal(parsed["FWK-217"], "전일 B");
  });

  it("taskLogsToMaps maps rows by issue key", () => {
    const { yesterdayByTask, todayByTask } = taskLogsToMaps(
      [
        { issueKey: "FWK-215", jiraIssueId: "215", yesterday: "y", today: "t" },
      ],
      ["FWK-215", "FWK-217"]
    );
    assert.equal(yesterdayByTask["FWK-215"], "y");
    assert.equal(todayByTask["FWK-215"], "t");
    assert.equal(yesterdayByTask["FWK-217"], "");
  });

  it("buildTaskLogRows includes jira_issue_id", () => {
    const rows = buildTaskLogRows(
      ["FWK-215"],
      { "FWK-215": "y" },
      { "FWK-215": "t" },
      new Map([["FWK-215", "jira-id-215"]])
    );
    assert.equal(rows[0].jiraIssueId, "jira-id-215");
  });
});
