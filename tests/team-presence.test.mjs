import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TEAM_MEMBERS } from "../src/lib/index.ts";
import {
  parseOnlineMemberIds,
  parseOnlineUsers,
  TEAM_PRESENCE_CHANNEL,
} from "../src/lib/realtime/team-presence.ts";

function countOnlineTeamMembers(onlineMemberIds) {
  return TEAM_MEMBERS.filter((m) => onlineMemberIds.has(m.id)).length;
}

const basePayload = {
  user_id: "user-1",
  login_id: "seo",
  member_id: "seo",
  display_name: "서선범",
  name: "서선범",
  avatar: "서",
  online_at: "2026-05-21T10:00:00.000Z",
};

describe("team-presence channel", () => {
  it("uses stable Supabase channel name", () => {
    assert.equal(TEAM_PRESENCE_CHANNEL, "online-users");
  });
});

describe("parseOnlineMemberIds", () => {
  it("returns empty set for empty presence state", () => {
    const ids = parseOnlineMemberIds({});
    assert.equal(ids.size, 0);
  });

  it("collects member_id from all presence keys", () => {
    const state = {
      "session-a": [basePayload],
      "session-b": [
        {
          ...basePayload,
          user_id: "user-2",
          member_id: "lee",
          login_id: "lee",
          name: "이지상",
        },
      ],
    };
    const ids = parseOnlineMemberIds(state);
    assert.equal(ids.size, 2);
    assert.ok(ids.has("seo"));
    assert.ok(ids.has("lee"));
  });

  it("dedupes same member_id across multiple tabs (presence keys)", () => {
    const state = {
      tab1: [basePayload],
      tab2: [{ ...basePayload, user_id: "user-1b", online_at: "2026-05-21T11:00:00.000Z" }],
    };
    const ids = parseOnlineMemberIds(state);
    assert.equal(ids.size, 1);
    assert.ok(ids.has("seo"));
  });

  it("ignores entries without member_id", () => {
    const state = {
      bad: [{ ...basePayload, member_id: "" }],
      good: [basePayload],
    };
    const ids = parseOnlineMemberIds(state);
    assert.equal(ids.size, 1);
    assert.ok(ids.has("seo"));
  });
});

describe("parseOnlineUsers", () => {
  it("returns one row per member_id (latest key order not guaranteed)", () => {
    const state = {
      tab1: [basePayload],
      tab2: [{ ...basePayload, user_id: "dup" }],
    };
    const users = parseOnlineUsers(state);
    assert.equal(users.length, 1);
    assert.equal(users[0].member_id, "seo");
  });
});

describe("sidebar online count (TeamMembersPopover logic)", () => {
  it("counts only TEAM_MEMBERS that are in onlineMemberIds", () => {
    const online = parseOnlineMemberIds({ u1: [basePayload] });
    assert.equal(countOnlineTeamMembers(online), 1);
    assert.equal(TEAM_MEMBERS.length, 7);
  });

  it("returns 0 when nobody is online", () => {
    assert.equal(countOnlineTeamMembers(new Set()), 0);
  });

  it("does not count unknown member_id", () => {
    const online = parseOnlineMemberIds({
      x: [{ ...basePayload, member_id: "unknown" }],
    });
    assert.equal(countOnlineTeamMembers(online), 0);
  });
});
