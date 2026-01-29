import { api } from "./client";
import type { Trip } from "../types/trip.ts";

export type CreateTripPayload = {
  title: string;
  timezone: string;
  startDate: string;
  endDate: string;
  notes?: string;
};

export async function createTrip(payload: CreateTripPayload): Promise<Trip> {
  const res = await api.post<Trip>("/api/trips", payload);
  return res.data;
}

export async function getTrip(tripId: string): Promise<Trip> {
  const res = await api.get<Trip>(`/api/trips/${tripId}`);
  return res.data;
}
