import { defineStore } from "pinia";

const tokenKey = (tripId: string) => `trip-collab:token:${tripId}`;
const lastTripKey = "trip-collab:lastTripId";

export type TripAccess = {
  memberToken: string;
  memberId?: string | null;
  role?: string | null;
  nickname?: string | null;
  joinedAt?: string | null;
  tripToken?: string | null;
};

function normalizeTripAccess(raw: unknown): TripAccess | null {
  if (!raw || typeof raw !== "object") return null;

  const memberToken = typeof (raw as any).memberToken === "string" ? (raw as any).memberToken.trim() : "";
  if (!memberToken) return null;

  return {
    memberToken,
    memberId: typeof (raw as any).memberId === "string" ? (raw as any).memberId : null,
    role: typeof (raw as any).role === "string" ? (raw as any).role : null,
    nickname: typeof (raw as any).nickname === "string" ? (raw as any).nickname : null,
    joinedAt: typeof (raw as any).joinedAt === "string" ? (raw as any).joinedAt : null,
    tripToken: typeof (raw as any).tripToken === "string" ? (raw as any).tripToken : null,
  };
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    currentTripId: "" as string,
  }),
  actions: {
    setTripAccess(tripId: string, payload: TripAccess) {
      const access: TripAccess = {
        memberToken: payload.memberToken.trim(),
        memberId: payload.memberId ?? null,
        role: payload.role ?? null,
        nickname: payload.nickname ?? null,
        joinedAt: payload.joinedAt ?? null,
        tripToken: payload.tripToken ?? null,
      };

      localStorage.setItem(tokenKey(tripId), JSON.stringify(access));
      localStorage.setItem(lastTripKey, tripId);
      this.currentTripId = tripId;
    },
    getTripAccess(tripId: string): TripAccess | null {
      const stored = localStorage.getItem(tokenKey(tripId));
      if (!stored) return null;

      try {
        const parsed = JSON.parse(stored);
        const access = normalizeTripAccess(parsed);
        if (access) return access;
        return null;
      } catch {
        // Legacy plain-string token. Remove it so member-token-only flows do not misread it.
        localStorage.removeItem(tokenKey(tripId));
        return null;
      }
    },
    clearTripAccess(tripId: string) {
      localStorage.removeItem(tokenKey(tripId));
      if (localStorage.getItem(lastTripKey) === tripId) {
        localStorage.removeItem(lastTripKey);
      }
    },
    setTripToken(tripId: string, token: string) {
      const access = this.getTripAccess(tripId);
      localStorage.setItem(
        tokenKey(tripId),
        JSON.stringify({
          memberToken: access?.memberToken ?? "",
          memberId: access?.memberId ?? null,
          role: access?.role ?? null,
          nickname: access?.nickname ?? null,
          joinedAt: access?.joinedAt ?? null,
          tripToken: token,
        }),
      );
      localStorage.setItem(lastTripKey, tripId);
      this.currentTripId = tripId;
    },
    getTripToken(tripId: string): string | null {
      const stored = localStorage.getItem(tokenKey(tripId));
      if (!stored) return null;

      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed?.tripToken === "string" && parsed.tripToken.trim()) {
          return parsed.tripToken;
        }
        return null;
      } catch {
        return stored;
      }
    },
    clearTripToken(tripId: string) {
      const access = this.getTripAccess(tripId);
      if (!access) {
        localStorage.removeItem(tokenKey(tripId));
      } else {
        localStorage.setItem(
          tokenKey(tripId),
          JSON.stringify({
            memberToken: access.memberToken,
            memberId: access.memberId ?? null,
            role: access.role ?? null,
            nickname: access.nickname ?? null,
            joinedAt: access.joinedAt ?? null,
            tripToken: null,
          }),
        );
      }
    },
    getLastTripId(): string | null {
      return localStorage.getItem(lastTripKey);
    },
  },
});
