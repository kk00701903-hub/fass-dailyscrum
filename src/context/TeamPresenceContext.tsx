import { createContext, useContext, type ReactNode } from "react";
import { useTeamPresence, type TeamPresenceState } from "@/hooks/use-team-presence";

const TeamPresenceContext = createContext<TeamPresenceState | null>(null);

export function TeamPresenceProvider({ children }: { children: ReactNode }) {
  const value = useTeamPresence();
  return (
    <TeamPresenceContext.Provider value={value}>{children}</TeamPresenceContext.Provider>
  );
}

export function useTeamPresenceContext(): TeamPresenceState {
  const ctx = useContext(TeamPresenceContext);
  if (!ctx) {
    return {
      channelReady: false,
      tracking: false,
      onlineMemberIds: new Set(),
      onlineUsers: [],
      isMemberOnline: () => false,
    };
  }
  return ctx;
}
