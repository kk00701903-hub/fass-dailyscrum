/**
 * Supabase Realtime Presence (팀원 접속) 라이브 스모크 테스트
 * 실행: npm run test:presence
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  parseOnlineMemberIds,
  TEAM_PRESENCE_CHANNEL,
} from "../src/lib/realtime/team-presence.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const p = resolve(root, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = (env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = (env.VITE_SUPABASE_ANON_KEY || "").trim();
const tlsInsecure =
  env.SUPABASE_TEST_TLS_INSECURE === "1" ||
  env.JIRA_TEST_TLS_INSECURE === "1" ||
  env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

if (tlsInsecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("⚠️  TLS 검증 비활성화\n");
}

if (!url || !key) {
  console.error("❌ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 필요");
  process.exit(1);
}

const TEST_MEMBER_ID = "seo";
const TEST_USER_ID = `presence-smoke-${Date.now()}`;
const TIMEOUT_MS = 20_000;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: ${TIMEOUT_MS}ms 초과`)), TIMEOUT_MS)
    ),
  ]);
}

async function run() {
  console.log(`\n📡 Realtime Presence — ${url}\n`);
  const supabase = createClient(url, key);

  let subscribed = false;
  let sawSelfOnline = false;
  let sawSelfOffline = false;

  const channel = supabase.channel(TEAM_PRESENCE_CHANNEL, {
    config: { presence: { key: TEST_USER_ID } },
  });

  const checkPresence = (label) => {
    const state = channel.presenceState();
    const ids = parseOnlineMemberIds(state);
    const online = ids.has(TEST_MEMBER_ID);
    console.log(`  [${label}] online member_ids: ${[...ids].join(", ") || "(없음)"}`);
    return online;
  };

  await withTimeout(
    new Promise((resolve, reject) => {
      channel
        .on("presence", { event: "sync" }, () => {
          if (checkPresence("sync")) sawSelfOnline = true;
        })
        .on("presence", { event: "join" }, () => {
          if (checkPresence("join")) sawSelfOnline = true;
        })
        .on("presence", { event: "leave" }, () => {
          if (!checkPresence("leave")) sawSelfOffline = true;
        })
        .subscribe(async (status) => {
          console.log(`  subscribe status: ${status}`);
          if (status === "SUBSCRIBED") {
            subscribed = true;
            const payload = {
              user_id: TEST_USER_ID,
              login_id: "seo-smoke",
              member_id: TEST_MEMBER_ID,
              display_name: "Presence Smoke",
              name: "서선범",
              avatar: "서",
              online_at: new Date().toISOString(),
            };
            const { error } = await channel.track(payload);
            if (error) {
              reject(new Error(`track 실패: ${error.message}`));
              return;
            }
            console.log("  track() 완료 — member_id=seo");
            await wait(1500);
            if (checkPresence("after-track")) sawSelfOnline = true;

            await channel.untrack();
            console.log("  untrack() 완료");
            await wait(1500);
            if (!checkPresence("after-untrack")) sawSelfOffline = true;

            resolve();
          } else if (status === "CHANNEL_ERROR") {
            reject(new Error("CHANNEL_ERROR — Realtime/Presence 설정 확인"));
          }
        });
    }),
    "Presence 채널"
  );

  supabase.removeChannel(channel);

  console.log("");
  if (!subscribed) {
    console.error("❌ 채널 구독 실패");
    process.exit(1);
  }
  if (!sawSelfOnline) {
    console.error("❌ track 후 presence에 seo 가 보이지 않음");
    process.exit(1);
  }
  if (!sawSelfOffline) {
    console.warn("⚠️  untrack 후 즉시 offline 반영이 안 됨 (다른 탭 접속 시 카운트에 영향 가능)");
  }

  console.log("✅ Realtime Presence 동작 확인");
  console.log("   · 채널 online-users 구독");
  console.log("   · track → member_id seo 접속 반영");
  console.log("   · parseOnlineMemberIds → UI ‘접속 N’ 카운트와 동일 로직\n");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
