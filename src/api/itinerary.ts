import { api } from "./client";
import type {
  AiItineraryGeneratePayload,
  AiItineraryGenerateResponse,
  ItineraryItem,
  ItineraryPatch,
} from "../types/itinerary";

function normalizeItineraryItem(raw: any): ItineraryItem {
  const dayDate = raw?.dayDate ?? raw?.day_date ?? raw?.date ?? "";
  const startTime = raw?.startTime ?? raw?.start_time ?? raw?.time ?? null;
  const endTime = raw?.endTime ?? raw?.end_time ?? null;
  const locationName =
    raw?.locationName ?? raw?.location_name ?? raw?.location ?? null;
  const mapUrl = raw?.mapUrl ?? raw?.map_url ?? null;
  const note = raw?.note ?? raw?.notes ?? null;
  const sortOrder = raw?.sortOrder ?? raw?.sort_order ?? null;

  return {
    id: raw?.id ?? "",
    tripId: raw?.tripId ?? raw?.trip_id ?? "",
    dayDate,
    startTime,
    endTime,
    title: raw?.title ?? raw?.name ?? "",
    locationName,
    mapUrl,
    note,
    sortOrder,
  };
}

export async function getItineraryByDate(
  tripId: string,
  date: string,
): Promise<ItineraryItem[]> {
  const res = await api.get<ItineraryItem[]>(`/api/trips/${tripId}/itinerary`, {
    params: { date },
  });
  const data = res.data as any;
  const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
  return list.map(normalizeItineraryItem);
}

export async function searchItineraryItems(
  tripId: string,
  q: string,
  limit?: number,
): Promise<ItineraryItem[]> {
  const params: Record<string, string | number> = { q };
  if (typeof limit === "number") params.limit = limit;
  const res = await api.get(`/api/trips/${tripId}/itinerary/search`, {
    params,
  });
  const data = res.data as any;
  const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
  return list.map(normalizeItineraryItem);
}

export async function generateAiItineraryDraft(
  tripId: string,
  payload: AiItineraryGeneratePayload,
): Promise<AiItineraryGenerateResponse> {
  const res = await api.post<AiItineraryGenerateResponse>(
    `/api/trips/${tripId}/itinerary/ai/generate`,
    payload,
    { timeout: 60000 },
  );
  const data = res.data as any;
  const draft = data?.data ?? data;
  return {
    tripId: draft?.tripId ?? draft?.trip_id ?? tripId,
    fallback: Boolean(draft?.fallback),
    fallbackReason: draft?.fallbackReason ?? draft?.fallback_reason ?? null,
    explanation: draft?.explanation ?? null,
    warnings: Array.isArray(draft?.warnings) ? draft.warnings : [],
    days: Array.isArray(draft?.days) ? draft.days : [],
  };
}

export type CreateItineraryPayload = {
  dayDate: string; // YYYY-MM-DD
  title: string;
  startTime?: string | null; // HH:mm:ss
  endTime?: string | null; // HH:mm:ss
  locationName?: string | null;
  mapUrl?: string | null;
  note?: string | null;
  sortOrder?: number | null;
};

export type PastePreviewItem = {
  lineNo: number;
  startTime?: string | null;
  title: string;
  locationName?: string | null;
  note?: string | null;
};

export type PastePreviewError = {
  lineNo: number;
  message: string;
};

export type PastePreviewResult = {
  items: PastePreviewItem[];
  errors: PastePreviewError[];
};

export async function createItineraryItem(
  tripId: string,
  payload: CreateItineraryPayload,
): Promise<ItineraryItem> {
  const res = await api.post<ItineraryItem>(
    `/api/trips/${tripId}/itinerary`,
    payload,
  );
  const data = res.data as any;
  const item = data?.item ?? data?.data ?? data;
  return normalizeItineraryItem(item);
}

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export async function patchItineraryItem(
  tripId: string,
  itemId: string,
  patch: ItineraryPatch,
) {
  const payload = stripUndefined(patch);
  const res = await api.patch(
    `/api/trips/${tripId}/itinerary/${itemId}`,
    payload,
  );
  // 若你的 client 有 unwrap logic 就照舊；沒有就直接 res.data
  return normalizeItineraryItem(res.data);
}

export async function deleteItineraryItem(tripId: string, itemId: string) {
  await api.delete(`/api/trips/${tripId}/itinerary/${itemId}`);
}

export async function reorderItinerary(
  tripId: string,
  date: string,
  ids: string[],
): Promise<void> {
  const payload = Array.isArray(ids) ? ids.map((id) => ({ id })) : [];
  await api.put(`/api/trips/${tripId}/itinerary/reorder`, payload, {
    params: { date },
  });
}

export async function moveItineraryItem(
  tripId: string,
  itemId: string,
  toDate: string,
): Promise<ItineraryItem> {
  const res = await api.post(`/api/trips/${tripId}/itinerary/${itemId}/move`, {
    toDate,
  });
  const data = res.data as any;
  const item = data?.item ?? data?.data ?? data;
  return normalizeItineraryItem(item);
}

export async function pastePreviewItinerary(
  tripId: string,
  text: string,
): Promise<PastePreviewResult> {
  const res = await api.post(`/api/trips/${tripId}/itinerary/paste/preview`, {
    text,
  });
  const data = res.data as any;
  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const rawErrors = Array.isArray(data?.errors) ? data.errors : [];
  const items = rawItems.map((item: any) => ({
    lineNo: item?.lineNo ?? item?.line_no ?? 0,
    startTime: item?.startTime ?? item?.start_time ?? null,
    title: item?.title ?? "",
    locationName: item?.locationName ?? item?.location_name ?? null,
    note: item?.note ?? item?.notes ?? null,
  }));
  const errors = rawErrors.map((err: any) => ({
    lineNo: err?.lineNo ?? err?.line_no ?? 0,
    message: err?.message ?? "Invalid line",
  }));
  return { items, errors };
}

export async function pasteCreateItinerary(
  tripId: string,
  dayDate: string,
  text: string,
): Promise<ItineraryItem[]> {
  const res = await api.post(`/api/trips/${tripId}/itinerary/paste`, {
    dayDate,
    text,
  });
  const data = res.data as any;
  const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
  return list.map(normalizeItineraryItem);
}
