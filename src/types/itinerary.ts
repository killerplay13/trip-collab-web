export type ItineraryItem = {
  id: string;
  tripId: string;
  dayDate: string; // YYYY-MM-DD
  startTime?: string | null; // HH:mm:ss
  endTime?: string | null; // HH:mm:ss
  title: string;
  locationName?: string | null;
  mapUrl?: string | null;
  note?: string | null;
  sortOrder?: number | null;
};


export type ItineraryPatch = Partial<{
  title: string;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  mapUrl: string | null;
  note: string | null;
}>;

export type AiItineraryGeneratePayload = {
  from?: string | null;
  to?: string | null;
  interests: string[];
  mustVisitPlaces: string[];
  avoidPlaces: string[];
  travelStyle?: string | null;
  budgetLevel?: string | null;
  notes?: string | null;
  language?: string | null;
};

export type AiItineraryDraftItem = {
  startTime?: string | null;
  endTime?: string | null;
  title: string;
  locationName?: string | null;
  mapUrl?: string | null;
  note?: string | null;
  sortOrder: number;
};

export type AiItineraryDraftDay = {
  dayDate: string;
  items: AiItineraryDraftItem[];
};

export type AiItineraryGenerateResponse = {
  tripId: string;
  fallback: boolean;
  fallbackReason?: string | null;
  explanation?: string | null;
  warnings: string[];
  days: AiItineraryDraftDay[];
};
