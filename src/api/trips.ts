import { api } from "./client";
import type { Trip } from "../types/trip.ts";

export type CreateTripPayload = {
  title: string;
  timezone: string;
  startDate: string;
  endDate: string;
  notes?: string;
  creatorNickname: string;
};

export async function createTrip(
  payload: CreateTripPayload,
): Promise<Trip & { inviteToken?: string; memberToken?: string; role?: string; nickname?: string }> {
  const res = await api.post<Trip>("/api/trips", payload);
  const data = res.data as any;
  const trip = (data?.trip ?? data?.data ?? data) as any;
  const inviteToken =
    trip?.inviteToken ?? trip?.invite_token ?? data?.inviteToken ?? data?.invite_token;
  if (inviteToken && !trip?.inviteToken) {
    trip.inviteToken = inviteToken;
  }

  const memberToken = trip?.memberToken ?? trip?.member_token ?? data?.memberToken ?? data?.member_token;
  if (memberToken && !trip?.memberToken) {
    trip.memberToken = memberToken;
  }

  const role = trip?.role ?? data?.role;
  if (role && !trip?.role) {
    trip.role = role;
  }

  const nickname = trip?.nickname ?? data?.nickname;
  if (nickname && !trip?.nickname) {
    trip.nickname = nickname;
  }

  return trip as Trip & { inviteToken?: string; memberToken?: string; role?: string; nickname?: string };
}

export async function getTrip(tripId: string): Promise<Trip> {
  const res = await api.get<Trip>(`/api/trips/${tripId}`);
  return res.data;
}

export type JoinTripPayload = {
  nickname: string;
};

export type JoinTripResult = {
  tripId: string;
  memberToken: string;
  role?: string | null;
  nickname?: string | null;
  joinedAt?: string | null;
};

export async function joinTrip(
  tripId: string,
  inviteToken: string,
  payload: JoinTripPayload,
): Promise<JoinTripResult> {
  const res = await api.post(`/api/trips/${tripId}/members`, payload, {
    headers: {
      "X-Trip-Token": inviteToken,
    },
  });

  const data = res.data as any;
  const member = (data?.member ?? data?.data ?? data) as any;
  const result: JoinTripResult = {
    tripId: member?.tripId ?? member?.trip_id ?? data?.tripId ?? data?.trip_id ?? tripId,
    memberToken:
      member?.memberToken ??
      member?.member_token ??
      data?.memberToken ??
      data?.member_token ??
      "",
    role: member?.role ?? data?.role ?? null,
    nickname: member?.nickname ?? data?.nickname ?? payload.nickname ?? null,
    joinedAt: member?.joinedAt ?? member?.joined_at ?? data?.joinedAt ?? data?.joined_at ?? null,
  };

  if (!result.memberToken) {
    throw new Error("Join trip did not return memberToken");
  }

  return result;
}
