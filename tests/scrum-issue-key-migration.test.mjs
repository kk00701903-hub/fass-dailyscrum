import assert from "node:assert/strict";
import test from "node:test";
import { migrateSelectedTaskKeys } from "../src/lib/scrum-jira-reconcile.ts";

test("migrateSelectedTaskKeys: renames keys in selection", () => {
  const migrations = new Map([["FWK-164", "FWK-220"]]);
  assert.deepEqual(migrateSelectedTaskKeys(["FWK-164", "FWK-215"], migrations), [
    "FWK-220",
    "FWK-215",
  ]);
});
