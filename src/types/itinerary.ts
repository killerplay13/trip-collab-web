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