import { defineStore } from "pinia";

const tokenKey = (tripId: string) => `trip-collab:token:${tripId}`;
const lastTripKey = "trip-collab:lastTripId";

export const useSessionStore = defineStore("session", {
  state: () => ({
    currentTripId: "" as string,
  }),
  actions: {
    setTripToken(tripId: string, token: string) {
      localStorage.setItem(tokenKey(tripId), token);
      localStorage.setItem(lastTripKey, tripId);
      this.currentTripId = tripId;
    },
    getTripToken(tripId: string): string | null {
      return localStorage.getItem(tokenKey(tripId));
    },
    clearTripToken(tripId: string) {
      localStorage.removeItem(tokenKey(tripId));
      if (localStorage.getItem(lastTripKey) === tripId) {
        localStorage.removeItem(lastTripKey);
      }
    },
    getLastTripId(): string | null {
      return localStorage.getItem(lastTripKey);
    },
  },
});
