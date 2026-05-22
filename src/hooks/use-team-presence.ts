import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getTeamMember } from "@/lib/index";
import {
  parseOnlineMemberIds,
  parseOnlineUsers,
  TEAM_PRESENCE_CHANNEL,
  type TeamPresencePayload,
} from "@/lib/realtime/team-presence";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

export interface TeamPresenceState {
  /** Realtime 채널 연결됨 */
  channelReady: boolean;
  /** 본인 presence track 완료 */
  tracking: boolean;
  onlineMemberIds: Set<string>;
  onlineUsers: TeamPresencePayload[];
  isMemberOnline: (memberId: string) => boolean;
}

function syncFromChannel(channel: RealtimeChannel): Pick<TeamPresenceState, "onlineMemberIds" | "onlineUsers"> {
  const state = channel.presenceState<TeamPresencePayload>();
  return {
    onlineMemberIds: parseOnlineMemberIds(state),
    onlineUsers: parseOnlineUsers(state),
  };
}

export function useTeamPresence(): TeamPresenceState {
  const user = useAuthStore((s) => s.user);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  const [channelReady, setChannelReady] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<TeamPresencePayload[]>([]);

  const applySync = useCallback((channel: RealtimeChannel) => {
    const next = syncFromChannel(channel);
    setOnlineMemberIds(next.onlineMemberIds);
    setOnlineUsers(next.onlineUsers);
  }, []);

  const trackSelf = useCallback(async (channel: RealtimeChannel) => {
    const u = userRef.current;
    if (!u) {
      setTracking(false);
      return;
    }
    const member = getTeamMember(u.memberId);
    const payload: TeamPresencePayload = {
      user_id: u.id,
      login_id: u.loginId,
      member_id: u.memberId,
      display_name: u.displayName,
      name: member.name,
      avatar: member.avatar,
      online_at: new Date().toISOString(),
    };
    const { error } = await channel.track(payload);
    if (!error) setTracking(true);
  }, []);

  const untrackSelf = useCallback(async (channel: RealtimeChannel | null) => {
    if (!channel) return;
    try {
      await channel.untrack();
    } catch {
      /* ignore */
    }
    setTracking(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChannelReady(false);
      setTracking(false);
      setOnlineMemberIds(new Set());
      setOnlineUsers([]);
      return;
    }

    const supabase = getSupabase();
    const presenceKey = user?.id ?? `guest-${crypto.randomUUID()}`;

    const channel = supabase.channel(TEAM_PRESENCE_CHANNEL, {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        applySync(channel);
      })
      .on("presence", { event: "join" }, () => {
        applySync(channel);
      })
      .on("presence", { event: "leave" }, () => {
        applySync(channel);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setChannelReady(true);
          if (userRef.current) {
            await trackSelf(channel);
          }
          applySync(channel);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setChannelReady(false);
          setTracking(false);
        }
      });

    channelRef.current = channel;

    const onPageHide = () => {
      void untrackSelf(channelRef.current);
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void untrackSelf(channel);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setChannelReady(false);
      setTracking(false);
      setOnlineMemberIds(new Set());
      setOnlineUsers([]);
    };
  }, [user?.id, applySync, trackSelf, untrackSelf]);

  /** 로그인 직후 user가 생기면 track (채널은 이미 구독 중일 수 있음) */
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !channelReady || !user) return;
    void trackSelf(channel).then(() => applySync(channel));
  }, [user, channelReady, trackSelf, applySync]);

  /** 로그아웃 시 untrack */
  useEffect(() => {
    if (user) return;
    const channel = channelRef.current;
    if (!channel) return;
    void untrackSelf(channel).then(() => applySync(channel));
  }, [user, untrackSelf, applySync]);

  const isMemberOnline = useCallback(
    (memberId: string) => onlineMemberIds.has(memberId),
    [onlineMemberIds]
  );

  return {
    channelReady,
    tracking,
    onlineMemberIds,
    onlineUsers,
    isMemberOnline,
  };
}
