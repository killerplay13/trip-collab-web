import { api } from "./client";

export type TripMember = {
  id: string;
  nickname: string;
  role?: string | null;
  isActive: boolean;
  joinedAt?: string | null;
};

function normalizeTripMember(raw: any): TripMember | null {
  const id = String(raw?.id ?? raw?.memberId ?? raw?.member_id ?? "").trim();
  if (!id) return null;

  return {
    id,
    nickname: String(raw?.nickname ?? raw?.name ?? id).trim() || id,
    role: raw?.role ?? null,
    isActive: raw?.isActive ?? raw?.is_active ?? true,
    joinedAt: raw?.joinedAt ?? raw?.joined_at ?? null,
  };
}

export async function getTripMembers(tripId: string): Promise<TripMember[]> {
  const res = await api.get(`/api/trips/${tripId}/members`);
  const data = res.data as any;
  const list = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
  return list
    .map(normalizeTripMember)
    .filter((member: TripMember | null): member is TripMember => Boolean(member))
    .filter((member: TripMember) => member.isActive);
}

export type UpdateMemberPayload = {
  nickname?: string;
  isActive?: boolean;
};

export async function updateTripMember(tripId: string, memberId: string, payload: UpdateMemberPayload): Promise<TripMember> {
  const res = await api.patch(`/api/trips/${tripId}/members/${memberId}`, payload);
  const data = res.data;
  const normalized = normalizeTripMember(data);
  if (!normalized) throw new Error("Failed to parse member response");
  return normalized;
}
