<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Calendar, DocumentAdd, Plus } from "@element-plus/icons-vue";
import {
  bulkCreateItinerary,
  createItineraryItem,
  deleteItineraryItem,
  generateAiItineraryDraft,
  getItineraryByDate,
  moveItineraryItem,
  pasteCreateItinerary,
  pastePreviewItinerary,
  patchItineraryItem,
  reorderItinerary,
  searchItineraryItems,
} from "../api/itinerary";
import type { PastePreviewResult } from "../api/itinerary";
import { getTrip } from "../api/trips";
import type { Trip } from "../types/trip";
import type { AiItineraryDraftItem, AiItineraryGenerateResponse, ItineraryItem } from "../types/itinerary";
import BottomSheet from "../components/BottomSheet.vue";
import ItineraryCreateForm from "../components/ItineraryCreateForm.vue";
import ItineraryItemActions from "../components/ItineraryItemActions.vue";
import { useTripAccess } from "../composables/useTripAccess";
import { usePullToRefresh } from "../composables/usePullToRefresh";
import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const { canEditData } = useTripAccess();
const { t, locale } = useI18n();

const tripId = computed(() => String(route.params.tripId || ""));

// --- date utilities (no external libs) ---
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}


const trip = ref<Trip | null>(null);

const selectedDate = computed<string>(() => {
  const q = route.query.date;
  if (typeof q === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  if (trip.value?.startDate) return trip.value.startDate;
  return toYmd(new Date());
});

const dateTabs = computed(() => {
  if (!trip.value || !trip.value.startDate || !trip.value.endDate) return [];
  const start = new Date(trip.value.startDate);
  const end = new Date(trip.value.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const tabs = [];
  let current = new Date(start);
  let dayNum = 1;
  while (current <= end && dayNum <= 60) {
    const dateStr = toYmd(current);
    tabs.push({
      dateStr,
      dayNum,
      displayDate: `${current.getMonth() + 1}/${current.getDate()}`,
      weekday: current.toLocaleDateString(locale.value || 'en-US', { weekday: 'short' }),
    });
    current.setDate(current.getDate() + 1);
    dayNum++;
  }
  return tabs;
});



const loading = ref(false);
const errorMsg = ref("");
const items = ref<ItineraryItem[]>([]);
const reordering = ref(false);
const reorderError = ref<string | null>(null);
const movingItem = ref<ItineraryItem | null>(null);
const moveToDate = ref("");
const moving = ref(false);
const moveError = ref<string | null>(null);
const pasteOpen = ref(false);
const pasteText = ref("");
const pasteDayDate = ref("");
const pastePreview = ref<PastePreviewResult | null>(null);
const pasteLoading = ref(false);
const pasteError = ref<string | null>(null);
const searchQuery = ref("");
const searchLoading = ref(false);
const searchError = ref<string | null>(null);
const searchResults = ref<ItineraryItem[]>([]);
const searchMode = computed(() => searchQuery.value.trim().length > 0);
const aiDraft = ref<AiItineraryGenerateResponse | null>(null);
const aiLoading = ref(false);
const aiError = ref("");
const aiImporting = ref(false);
const aiImportError = ref<string | null>(null);
const aiImportSuccess = ref<string | null>(null);
const aiNotes = ref("");
const aiHelperOpen = ref(false);
const aiSelectedInterests = ref<string[]>([]);
const aiMustVisitText = ref("");
const aiAvoidText = ref("");
const aiMode = ref<"recommend_day" | "fill_gap" | "review_day">("recommend_day");

const aiModeOptions = [
  {
    value: "recommend_day",
    labelKey: "itinerary.aiModeRecommendDay",
    descriptionKey: "itinerary.aiModeRecommendDayDescription",
    disabled: false,
  },
  {
    value: "fill_gap",
    labelKey: "itinerary.aiModeFillGap",
    descriptionKey: "itinerary.aiModeFillGapDescription",
    disabled: true,
  },
  {
    value: "review_day",
    labelKey: "itinerary.aiModeReviewDay",
    descriptionKey: "itinerary.aiModeReviewDayDescription",
    disabled: true,
  },
] as const;

const aiPreferenceChips = [
  { value: "relaxed", labelKey: "itinerary.aiPreferenceRelaxed" },
  { value: "food", labelKey: "itinerary.aiPreferenceFood" },
  { value: "shopping", labelKey: "itinerary.aiPreferenceShopping" },
  { value: "family", labelKey: "itinerary.aiPreferenceFamily" },
  { value: "photo", labelKey: "itinerary.aiPreferencePhoto" },
  { value: "culture", labelKey: "itinerary.aiPreferenceCulture" },
];

const selectedAiDraftDay = computed(() =>
  aiDraft.value?.days.find((day) => day.dayDate === selectedDate.value) ?? null,
);
const selectedAiDraftItems = computed(() =>
  selectedAiDraftDay.value ? sortAiDraftItems(selectedAiDraftDay.value.items) : [],
);
const hasSelectedAiDraftItems = computed(() =>
  selectedAiDraftItems.value.length > 0,
);
const aiImportDisabled = computed(() =>
  aiImporting.value ||
  aiLoading.value ||
  aiMode.value !== "recommend_day" ||
  !aiDraft.value ||
  !hasSelectedAiDraftItems.value,
);
const aiQualityChecks = computed(() => aiDraft.value?.qualityChecks ?? null);
const aiQualityIssueKeys = computed(() => {
  const checks = aiQualityChecks.value;
  if (!checks) return [];
  const issues: string[] = [];
  if (checks.hasOutOfScopePlace) issues.push("itinerary.aiQualityOutOfScopePlace");
  if (checks.hasUnrealisticTransport) issues.push("itinerary.aiQualityUnrealisticTransport");
  if (checks.hasTimeConflict) issues.push("itinerary.aiQualityTimeConflict");
  if (checks.hasDuplicatePlace) issues.push("itinerary.aiQualityDuplicatePlace");
  if (checks.needsUserReview) issues.push("itinerary.aiQualityNeedsReview");
  return issues;
});
const hasAiQualityIssues = computed(() => aiQualityIssueKeys.value.length > 0);

function formatTimeRange(item: ItineraryItem) {
  const start = item.startTime ? item.startTime.slice(0, 5) : "";
  const end = item.endTime ? item.endTime.slice(0, 5) : "";
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

function formatAiTimeRange(item: AiItineraryDraftItem) {
  const start = item.startTime ? item.startTime.slice(0, 5) : "";
  const end = item.endTime ? item.endTime.slice(0, 5) : "";
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

function formatAiWarningMessage(message: string) {
  return message
    .replace(/因\s*avoid_duplicate_places\s*為\s*true[，,]?\s*/gi, "系統已啟用避免重複推薦，")
    .replace(/because\s+avoid_duplicate_places\s+is\s+true[,.]?\s*/gi, "duplicate recommendations are being avoided, ")
    .replace(/avoid_duplicate_places\s+is\s+true/gi, "duplicate recommendations are being avoided")
    .replace(/avoid_duplicate_places\s*為\s*true/gi, "系統已啟用避免重複推薦")
    .replace(/existing_itinerary/gi, "已安排的行程")
    .replace(/must_visit_places/gi, "必去地點")
    .replace(/must_visit_place/gi, "必去地點")
    .replace(/fallback_reason/gi, "備用草稿原因")
    .replace(/未能再次加入/g, "這次先避免重複加入")
    .replace(/JSON field/gi, "欄位")
    .replace(/\bflag\b/gi, "設定");
}

function sortAiDraftItems(items: AiItineraryDraftItem[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aOrder = Number.isFinite(a.item.sortOrder) ? a.item.sortOrder : null;
      const bOrder = Number.isFinite(b.item.sortOrder) ? b.item.sortOrder : null;
      if (aOrder !== null && bOrder !== null && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function toggleAiInterest(value: string) {
  if (aiLoading.value) return;
  if (aiSelectedInterests.value.includes(value)) {
    aiSelectedInterests.value = aiSelectedInterests.value.filter((item) => item !== value);
    return;
  }
  aiSelectedInterests.value = [...aiSelectedInterests.value, value];
}

function parseAiTextList(text: string) {
  return text
    .split(/[,\n，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectAiMode(mode: "recommend_day" | "fill_gap" | "review_day", disabled: boolean) {
  if (disabled) return;
  aiMode.value = mode;
}

function clearAiDraft() {
  aiDraft.value = null;
  aiError.value = "";
  aiImportError.value = null;
  aiImportSuccess.value = null;
}

async function regenerateAiDraft() {
  await handleGenerateAiDraft();
}

async function handleGenerateAiDraft() {
  if (!tripId.value || aiLoading.value) return;
  aiLoading.value = true;
  aiError.value = "";
  aiImportError.value = null;
  aiImportSuccess.value = null;
  aiDraft.value = null;
  try {
    aiDraft.value = await generateAiItineraryDraft(tripId.value, {
      from: selectedDate.value,
      to: selectedDate.value,
      interests: aiSelectedInterests.value,
      mustVisitPlaces: parseAiTextList(aiMustVisitText.value),
      avoidPlaces: parseAiTextList(aiAvoidText.value),
      travelStyle: aiSelectedInterests.value.includes("relaxed") ? "relaxed" : null,
      budgetLevel: null,
      notes: aiNotes.value.trim() || null,
      language: String(locale.value || "zh-TW"),
    });
  } catch (e: any) {
    aiError.value =
      e?.response?.data?.message ?? e?.message ?? t("itinerary.aiErrorFallback");
  } finally {
    aiLoading.value = false;
  }
}

async function handleImportAiDraft() {
  if (
    !tripId.value ||
    aiImporting.value ||
    aiLoading.value ||
    aiMode.value !== "recommend_day" ||
    !aiDraft.value
  ) {
    return;
  }

  const targetDay = selectedAiDraftDay.value;
  const targetItems = selectedAiDraftItems.value;
  if (!targetDay || !targetItems.length) {
    aiImportError.value = t("itinerary.aiImportNoItems");
    aiImportSuccess.value = null;
    return;
  }

  const confirmMessage = hasAiQualityIssues.value
    ? t("itinerary.aiQualityReviewBeforeImportConfirm")
    : t("itinerary.aiImportQualityConfirm");
  if (!window.confirm(confirmMessage)) return;

  aiImporting.value = true;
  aiImportError.value = null;
  aiImportSuccess.value = null;
  try {
    await bulkCreateItinerary(tripId.value, {
      dayDate: selectedDate.value,
      items: targetItems.map((item) => ({
        startTime: item.startTime ?? null,
        endTime: item.endTime ?? null,
        title: item.title,
        locationName: item.locationName ?? null,
        mapUrl: item.mapUrl ?? null,
        note: item.note ?? null,
      })),
    });
    await load();
    aiDraft.value = null;
    aiError.value = "";
    aiImportError.value = null;
    aiImportSuccess.value = t("itinerary.aiImportSuccess");
  } catch (e: any) {
    aiImportError.value =
      e?.response?.data?.message ?? e?.message ?? t("itinerary.aiImportFailed");
  } finally {
    aiImporting.value = false;
  }
}

async function load(options: { silent?: boolean } = {}) {
  if (!tripId.value) return;
  const silent = options.silent === true;
  if (!silent) loading.value = true;
  errorMsg.value = "";
  reorderError.value = null;
  try {
    const res = await getItineraryByDate(tripId.value, selectedDate.value);
    items.value = Array.isArray(res) ? res : [];
  } catch (e: any) {
    errorMsg.value =
      e?.response?.data?.message ?? e?.message ?? t('itinerary.loadFailed');
    if (!silent) items.value = [];
  } finally {
    if (!silent) loading.value = false;
  }
}

const pullToRefresh = usePullToRefresh(() => load({ silent: true }));

function swap(list: unknown, i: number, j: number): ItineraryItem[] {
  if (!Array.isArray(list)) return [];
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

async function persistReorder(newItems: ItineraryItem[]) {
  if (!tripId.value) return;
  reordering.value = true;
  reorderError.value = null;
  try {
    await reorderItinerary(
      tripId.value,
      selectedDate.value,
      newItems.map((i) => i.id),
    );
  } catch (e: any) {
    reorderError.value =
      e?.response?.data?.message ?? e?.message ?? t('itinerary.saveOrderFailed');
    await load();
  } finally {
    reordering.value = false;
  }
}

async function moveUp(idx: number) {
  if (idx <= 0 || reordering.value) return;
  const next = swap(items.value, idx, idx - 1);
  items.value = next;
  await persistReorder(next);
}

async function moveDown(idx: number) {
  if (idx >= items.value.length - 1 || reordering.value) return;
  const next = swap(items.value, idx, idx + 1);
  items.value = next;
  await persistReorder(next);
}

async function goDate(date: string) {
  await router.replace({
    path: route.path,
    query: { ...route.query, date },
  });
}



const sheetOpen = ref(false);
const sheetMode = ref<"create" | "edit">("create");
const editingItem = ref<ItineraryItem | null>(null);
const deletingItem = ref<ItineraryItem | null>(null);
const creating = ref(false);
const createError = ref("");

function openCreate() {
  createError.value = "";
  sheetMode.value = "create";
  editingItem.value = null;
  sheetOpen.value = true;
}

function openEdit(item: ItineraryItem) {
  createError.value = "";
  sheetMode.value = "edit";
  editingItem.value = item;
  sheetOpen.value = true;
}

function resetSheet() {
  sheetOpen.value = false;
  editingItem.value = null;
  sheetMode.value = "create";
}

async function handleCreate(payload: {
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  locationName?: string | null;
  mapUrl?: string | null;
  note?: string | null;
  sortOrder?: number;
}) {
  if (!tripId.value) return;
  creating.value = true;
  createError.value = "";
  try {
    await createItineraryItem(tripId.value, {
      ...payload,
      dayDate: selectedDate.value,
    });
    sheetOpen.value = false;
    await load(); // refresh list
  } catch (e: any) {
    createError.value =
      e?.response?.data?.message ?? e?.message ?? t('itinerary.createFailed');
  } finally {
    creating.value = false;
  }
}

async function handleEdit(payload: {
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  locationName?: string | null;
  mapUrl?: string | null;
  note?: string | null;
}) {
  if (!tripId.value || !editingItem.value) return;
  creating.value = true;
  createError.value = "";
  try {
    await patchItineraryItem(tripId.value, editingItem.value.id, {
      title: payload.title,
      startTime: payload.startTime,
      endTime: payload.endTime,
      locationName: payload.locationName,
      mapUrl: payload.mapUrl,
      note: payload.note,
    });
    resetSheet();
    await load();
  } catch (e: any) {
    createError.value =
      e?.response?.data?.message ?? e?.message ?? t('itinerary.updateFailed');
  } finally {
    creating.value = false;
  }
}

async function handleSubmit(payload: {
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  locationName?: string | null;
  mapUrl?: string | null;
  note?: string | null;
  sortOrder?: number;
}) {
  if (sheetMode.value === "edit") {
    const editPayload: {
      title: string;
      startTime?: string | null;
      endTime?: string | null;
      locationName?: string | null;
      mapUrl?: string | null;
      note?: string | null;
    } = {
      title: payload.title,
      startTime: payload.startTime,
      endTime: payload.endTime,
      locationName: payload.locationName,
      mapUrl: payload.mapUrl,
      note: payload.note,
    };
    await handleEdit(editPayload);
    return;
  }
  await handleCreate(payload);
}

function askDelete(item: ItineraryItem) {
  deletingItem.value = item;
}

async function confirmDelete() {
  if (!tripId.value || !deletingItem.value) return;
  try {
    await deleteItineraryItem(tripId.value, deletingItem.value.id);
    deletingItem.value = null;
    await load();
  } catch (e: any) {
    createError.value =
      e?.response?.data?.message ?? e?.message ?? t('itinerary.deleteFailed');
  }
}

function askMove(item: ItineraryItem) {
  movingItem.value = item;
  moveToDate.value = selectedDate.value;
  moveError.value = null;
}

function cancelMove() {
  movingItem.value = null;
  moveToDate.value = "";
  moveError.value = null;
}

async function confirmMove() {
  if (!tripId.value || !movingItem.value) return;
  const toDate = moveToDate.value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    moveError.value = "Please choose a valid date.";
    return;
  }
  if (toDate === movingItem.value.dayDate) {
    moveError.value = "Item is already on that date.";
    return;
  }
  moving.value = true;
  moveError.value = null;
  try {
    await moveItineraryItem(tripId.value, movingItem.value.id, toDate);
    items.value = await getItineraryByDate(tripId.value, selectedDate.value);
    cancelMove();
  } catch (e: any) {
    moveError.value =
      e?.response?.data?.message ??
      e?.message ??
      t('itinerary.moveFailed');
  } finally {
    moving.value = false;
  }
}

function openPaste() {
  pasteOpen.value = true;
  pasteDayDate.value = selectedDate.value;
  pasteText.value = "";
  pastePreview.value = null;
  pasteError.value = null;
}

function closePaste() {
  pasteOpen.value = false;
  pasteText.value = "";
  pastePreview.value = null;
  pasteError.value = null;
  pasteLoading.value = false;
  pasteDayDate.value = "";
}

async function runPreview() {
  if (!tripId.value) return;
  const text = pasteText.value.trim();
  if (!text) {
    pasteError.value = "Please paste some text.";
    return;
  }
  pasteLoading.value = true;
  pasteError.value = null;
  try {
    pastePreview.value = await pastePreviewItinerary(
      tripId.value,
      pasteText.value,
    );
  } catch (e: any) {
    pasteError.value =
      e?.response?.data?.message ??
      e?.message ??
      t('itinerary.previewFailed');
  } finally {
    pasteLoading.value = false;
  }
}

async function confirmPasteCreate() {
  if (!tripId.value || !pastePreview.value) return;
  if (pastePreview.value.errors.length > 0) return;
  const dayDate = pasteDayDate.value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayDate)) {
    pasteError.value = "Please choose a valid date.";
    return;
  }
  pasteLoading.value = true;
  pasteError.value = null;
  try {
    await pasteCreateItinerary(tripId.value, dayDate, pasteText.value);
    items.value = await getItineraryByDate(tripId.value, selectedDate.value);
    closePaste();
  } catch (e: any) {
    pasteError.value =
      e?.response?.data?.message ??
      e?.message ??
      t('itinerary.pasteFailed');
  } finally {
    pasteLoading.value = false;
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

let searchSeq = 0;
const debouncedSearch = debounce(async (q: string) => {
  if (!tripId.value || searchQuery.value.trim() !== q) {
    searchLoading.value = false;
    return;
  }
  const seq = ++searchSeq;
  try {
    const res = await searchItineraryItems(tripId.value, q, 50);
    if (seq !== searchSeq) return;
    searchResults.value = res;
    searchError.value = null;
  } catch (e: any) {
    if (seq !== searchSeq) return;
    searchError.value =
      e?.response?.data?.message ??
      e?.message ??
      t('itinerary.searchFailed');
    searchResults.value = [];
  } finally {
    if (seq === searchSeq) searchLoading.value = false;
  }
}, 300);

async function selectSearchResult(item: ItineraryItem) {
  await router.push({
    path: route.path,
    query: { ...route.query, date: item.dayDate },
  });
  searchQuery.value = "";
  searchResults.value = [];
  searchError.value = null;
  resetSheet();
  deletingItem.value = null;
  cancelMove();
  pasteOpen.value = false;
}

function getExpensePrefillTitle(item: ItineraryItem) {
  return item.locationName?.trim() || item.title?.trim() || t("itinerary.untitled");
}

async function openExpenseFromItinerary(item: ItineraryItem) {
  if (!tripId.value) return;
  await router.push({
    path: `/t/${tripId.value}/expenses`,
    query: {
      prefillTitle: getExpensePrefillTitle(item),
    },
  });
}

onMounted(async () => {
  if (tripId.value) {
    try {
      trip.value = await getTrip(tripId.value);
    } catch (e) {
      console.error(e);
    }
  }
  void load();
});
watch(() => selectedDate.value, () => {
  aiDraft.value = null;
  aiError.value = "";
  aiImportError.value = null;
  aiImportSuccess.value = null;
  void load();
});
watch(searchQuery, (value) => {
  const q = value.trim();
  if (!q) {
    searchSeq += 1;
    searchResults.value = [];
    searchError.value = null;
    searchLoading.value = false;
    return;
  }
  searchLoading.value = true;
  searchError.value = null;
  debouncedSearch(q);
});
</script>

<template>
  <div
    class="pb-24"
    @touchstart="pullToRefresh.onTouchStart"
    @touchmove="pullToRefresh.onTouchMove"
    @touchend="pullToRefresh.onTouchEnd"
    @touchcancel="pullToRefresh.onTouchEnd"
  >
    <div
      class="pointer-events-none fixed left-1/2 top-0 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/90 text-emerald-300 opacity-0 shadow-lg ring-1 ring-zinc-700/70 backdrop-blur transition-opacity duration-150"
      :style="pullToRefresh.indicatorStyle.value"
    >
      <div class="h-3.5 w-3.5 rounded-full border-2 border-emerald-300/30 border-t-emerald-300 animate-spin"></div>
    </div>
    <!-- Non-Sticky Title -->
    <div class="pt-6 pb-3">
      <h1 class="text-3xl font-bold tracking-tight text-gradient">{{ $t('itinerary.itineraryTitle') }}</h1>
    </div>

    <!-- AI Helper Panel (Non-Sticky) -->
    <section v-if="!searchMode" class="mb-6 glass-card p-4 animate-fade-in-up">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-bold text-zinc-100">{{ $t('itinerary.aiHelperTitle') }}</h2>
            <span class="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
              {{ selectedDate }}
            </span>
          </div>
          <p class="mt-1 text-sm leading-relaxed text-zinc-400">
            {{ $t('itinerary.aiHelperCollapsedDescription') }}
          </p>
        </div>

        <button
          type="button"
          class="shrink-0 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800 transition-all hover:bg-zinc-800 active:scale-95"
          @click="aiHelperOpen = !aiHelperOpen"
        >
          {{ aiHelperOpen ? $t('itinerary.aiCollapse') : $t('itinerary.aiExpand') }}
        </button>
      </div>

      <div v-if="aiHelperOpen" class="mt-3 space-y-3">
        <div class="flex items-start gap-2 px-0.5 text-xs leading-relaxed text-zinc-500">
          <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"></span>
          <span>{{ $t('itinerary.aiSelectedDateOnlyNotice', { date: selectedDate }) }}</span>
        </div>
        <div class="flex items-start gap-2 px-0.5 text-xs leading-relaxed text-zinc-500">
          <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"></span>
          <span>{{ $t('itinerary.aiDuplicateAvoidanceNotice') }}</span>
        </div>

        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{{ $t('itinerary.aiModeTitle') }}</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <button
              v-for="option in aiModeOptions"
              :key="option.value"
              type="button"
              class="min-h-[58px] w-full rounded-xl px-2 py-2 text-center ring-1 transition-all active:scale-[0.99]"
              :class="[
                aiMode === option.value
                  ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-500/30'
                  : 'bg-zinc-900/60 text-zinc-300 ring-zinc-800/80',
                option.disabled
                  ? 'cursor-not-allowed opacity-65'
                  : 'hover:bg-zinc-800/80',
              ]"
              :aria-disabled="option.disabled"
              @click="selectAiMode(option.value, option.disabled)"
            >
              <div class="flex h-full flex-col items-center justify-center gap-1">
                <div class="text-xs font-bold leading-tight">{{ $t(option.labelKey) }}</div>
                <span
                  v-if="option.disabled"
                  class="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-zinc-500 ring-1 ring-zinc-700"
                >
                  {{ $t('itinerary.aiComingSoon') }}
                </span>
              </div>
            </button>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-zinc-500">
            {{ $t('itinerary.aiModeRecommendDayDescription') }}
          </p>
        </div>

        <template v-if="aiMode === 'recommend_day'">
          <div>
            <div class="mb-2 text-sm font-semibold text-zinc-200">{{ $t('itinerary.aiPreferenceTitle') }}</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="chip in aiPreferenceChips"
                :key="chip.value"
                type="button"
                class="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-all active:scale-95 disabled:opacity-60"
                :class="aiSelectedInterests.includes(chip.value)
                  ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                  : 'bg-zinc-900/70 text-zinc-300 ring-zinc-800 hover:bg-zinc-800'"
                :disabled="aiLoading"
                @click="toggleAiInterest(chip.value)"
              >
                {{ $t(chip.labelKey) }}
              </button>
            </div>
          </div>

          <label class="block">
            <div class="text-sm font-semibold text-zinc-200">{{ $t('itinerary.aiMustVisitLabel') }}</div>
            <input
              v-model="aiMustVisitText"
              :placeholder="$t('itinerary.aiMustVisitPlaceholder')"
              class="mt-2 w-full rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 transition-all focus:ring-emerald-500/50"
              :disabled="aiLoading"
            />
          </label>

          <label class="block">
            <div class="text-sm font-semibold text-zinc-200">{{ $t('itinerary.aiAvoidLabel') }}</div>
            <input
              v-model="aiAvoidText"
              :placeholder="$t('itinerary.aiAvoidPlaceholder')"
              class="mt-2 w-full rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 transition-all focus:ring-emerald-500/50"
              :disabled="aiLoading"
            />
          </label>

          <label class="block">
            <div class="text-sm font-semibold text-zinc-200">{{ $t('itinerary.aiNotesLabel') }}</div>
            <textarea
              v-model="aiNotes"
              rows="3"
              :placeholder="$t('itinerary.aiNotesPlaceholder')"
              class="mt-2 w-full rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-800 transition-all focus:ring-emerald-500/50"
              :disabled="aiLoading"
            />
          </label>

          <div v-if="aiError" class="rounded-xl bg-red-400/10 p-3 text-sm text-red-300 ring-1 ring-red-400/20">
            {{ aiError }}
          </div>

          <button
            type="button"
            class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            :disabled="aiLoading"
            @click="handleGenerateAiDraft"
          >
            {{ aiLoading ? $t('itinerary.aiGenerating') : $t('itinerary.aiGenerateSelectedDateButton') }}
          </button>
        </template>

        <div
          v-else
          class="rounded-xl bg-zinc-900/60 p-3 text-sm leading-relaxed text-zinc-300 ring-1 ring-zinc-800/70"
        >
          {{ $t('itinerary.aiModeComingSoonNotice') }}
        </div>
      </div>
    </section>

    <!-- Sticky Header (Search + Tabs) -->
    <div class="sticky top-0 z-30 -mx-4 px-4 py-2 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 shadow-md flex flex-col gap-2">
      <!-- Minimal Search Bar -->
      <div class="w-full relative">
        <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <input
          v-model="searchQuery"
          :placeholder="$t('itinerary.searchPlaceholder')"
          class="w-full rounded-xl bg-zinc-900/40 pl-10 pr-10 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 ring-1 ring-zinc-800/50 focus:ring-emerald-500/30 focus:bg-zinc-900/60 transition-all shadow-inner"
        />
        <button
          v-if="searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200"
          @click="searchQuery = ''"
          type="button"
          aria-label="Clear search"
        >
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      
      <div v-if="searchLoading" class="text-[10px] font-medium text-emerald-400 flex items-center gap-1.5 px-1"><div class="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></div>{{ $t('itinerary.searching') }}</div>
      <div v-else-if="searchError" class="text-[10px] text-red-400 bg-red-400/5 p-1.5 rounded-lg border border-red-400/10">{{ searchError }}</div>

      <!-- Date Tabs -->
      <div v-if="!searchMode && dateTabs.length > 0" class="flex overflow-x-auto gap-2 sm:mx-0 sm:px-0 pb-0.5" style="scrollbar-width: none;">
        <button
          v-for="tab in dateTabs"
          :key="tab.dateStr"
          @click="goDate(tab.dateStr)"
          class="flex flex-col items-center justify-center min-w-[4rem] px-2.5 py-1.5 rounded-xl border transition-all shrink-0 break-words whitespace-normal"
          :class="selectedDate === tab.dateStr 
            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10' 
            : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
        >
          <span class="text-[9px] font-bold uppercase tracking-wider mb-0.5" :class="selectedDate === tab.dateStr ? 'text-emerald-400' : 'text-zinc-500'">Day {{ tab.dayNum }}</span>
          <div class="text-sm font-bold flex items-baseline gap-1">
            {{ tab.displayDate }}
            <span class="text-[9px] font-medium opacity-80" :class="selectedDate === tab.dateStr ? 'text-emerald-400' : 'text-zinc-500'">{{ tab.weekday }}</span>
          </div>
        </button>
      </div>
    </div>

    <div
      v-if="!searchMode && aiImportSuccess"
      class="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-zinc-950/75 px-3 py-2.5 text-sm text-emerald-200 ring-1 ring-emerald-500/25 shadow-lg shadow-emerald-950/10"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-400"></span>
        <span class="min-w-0">{{ aiImportSuccess }}</span>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
        @click="aiImportSuccess = null"
      >
        {{ $t('itinerary.aiImportSuccessDismiss') }}
      </button>
    </div>

    <!-- AI Draft Result -->
    <section v-if="!searchMode && aiDraft" class="mt-4 rounded-3xl bg-zinc-950/70 p-4 ring-1 ring-sky-500/25 shadow-xl shadow-sky-950/20 animate-fade-in-up">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base font-bold text-sky-200">{{ $t('itinerary.aiDraftTitle') }}</h3>
            <span class="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-mono text-sky-200 ring-1 ring-sky-500/20">
              {{ selectedDate }}
            </span>
          </div>
          <p class="mt-1 text-sm text-zinc-400">{{ $t('itinerary.aiDraftOnlyNotice') }}</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 ring-1 ring-zinc-800 transition-all hover:bg-zinc-800 active:scale-95"
            :disabled="aiLoading || aiImporting"
            @click="clearAiDraft"
          >
            {{ $t('itinerary.aiClearDraft') }}
          </button>
          <button
            type="button"
            class="rounded-xl bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 ring-1 ring-sky-500/20 transition-all hover:bg-sky-500/20 active:scale-95 disabled:opacity-60"
            :disabled="aiLoading || aiImporting"
            @click="regenerateAiDraft"
          >
            {{ aiLoading ? $t('itinerary.aiGenerating') : $t('itinerary.aiRegenerate') }}
          </button>
          <button
            type="button"
            class="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/25 transition-all hover:bg-emerald-500/25 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-900/60 disabled:text-zinc-500 disabled:ring-zinc-800 disabled:hover:bg-zinc-900/60"
            :disabled="aiImportDisabled"
            @click="handleImportAiDraft"
          >
            {{ aiImporting ? $t('itinerary.aiImporting') : $t('itinerary.aiImportDraft') }}
          </button>
        </div>
        <p class="w-full text-xs leading-relaxed text-zinc-500 sm:w-auto sm:text-right">
          {{ $t('itinerary.aiReviewBeforeImport') }}
        </p>
      </div>

      <div class="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm leading-relaxed text-amber-100 ring-1 ring-amber-400/20">
        <div class="text-xs font-semibold uppercase tracking-wide text-amber-300">
          {{ $t('itinerary.aiQualityWarningTitle') }}
        </div>
        <p class="mt-1 text-amber-100/90">
          {{ $t('itinerary.aiQualityWarningDescription') }}
        </p>
      </div>

      <div
        v-if="hasAiQualityIssues"
        class="mt-4 rounded-xl bg-orange-500/10 p-3 text-sm leading-relaxed text-orange-100 ring-1 ring-orange-400/25"
      >
        <div class="text-xs font-semibold uppercase tracking-wide text-orange-300">
          {{ $t('itinerary.aiQualityNeedsReview') }}
        </div>
        <ul class="mt-2 space-y-1.5 text-orange-100/90">
          <li
            v-for="issueKey in aiQualityIssueKeys"
            :key="issueKey"
            class="flex gap-2"
          >
            <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300"></span>
            <span>{{ $t(issueKey) }}</span>
          </li>
        </ul>
      </div>

      <div class="mt-4 rounded-xl bg-sky-500/10 p-3 text-sm leading-relaxed text-sky-100 ring-1 ring-sky-500/20">
        {{ $t('itinerary.aiImportNotice') }}
      </div>

      <div
        v-if="aiImportError"
        class="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-300 ring-1 ring-red-400/20"
      >
        {{ aiImportError }}
      </div>

      <div
        v-if="aiDraft.fallback"
        class="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200 ring-1 ring-amber-400/20"
      >
        {{ $t('itinerary.aiFallbackWarning') }}
        <span v-if="aiDraft.fallbackReason" class="ml-1 text-amber-300">
          {{ aiDraft.fallbackReason }}
        </span>
        <p class="mt-2 leading-relaxed">
          {{ $t('itinerary.aiFallbackQualityWarning') }}
        </p>
      </div>

      <div v-if="aiDraft.warnings.length" class="mt-4 rounded-xl bg-zinc-900/60 p-3 ring-1 ring-zinc-800/70">
        <div class="text-xs font-semibold uppercase tracking-wide text-amber-300">
          {{ $t('itinerary.aiWarningsTitle') }}
        </div>
        <ul class="mt-2 space-y-1 text-sm text-zinc-300">
          <li v-for="warning in aiDraft.warnings" :key="warning">
            {{ formatAiWarningMessage(warning) }}
          </li>
        </ul>
      </div>

      <p
        v-if="aiDraft.explanation"
        class="mt-4 rounded-xl bg-zinc-900/60 p-3 text-sm leading-relaxed text-zinc-300 ring-1 ring-zinc-800/70"
      >
        {{ aiDraft.explanation }}
      </p>

      <div class="mt-4 space-y-4">
        <div
          v-if="selectedAiDraftDay"
          class="rounded-2xl bg-zinc-900/40 p-3 ring-1 ring-sky-500/15"
        >
          <div class="mb-3 text-sm font-semibold text-zinc-200">{{ selectedAiDraftDay.dayDate }}</div>
          <div class="space-y-3">
            <div
              v-for="(draftItem, draftIdx) in selectedAiDraftItems"
              :key="`${selectedAiDraftDay.dayDate}-${draftItem.sortOrder}-${draftIdx}`"
              class="rounded-2xl bg-zinc-950/70 p-3 ring-1 ring-sky-500/20"
            >
              <div class="flex items-start gap-3">
                <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-bold text-sky-200 ring-1 ring-sky-500/20">
                  {{ draftItem.sortOrder }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="mb-2 flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sky-200 ring-1 ring-sky-500/20">
                      {{ $t('itinerary.aiDraftBadge') }}
                    </span>
                    <span
                      v-if="formatAiTimeRange(draftItem)"
                      class="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/20"
                    >
                      {{ formatAiTimeRange(draftItem) }}
                    </span>
                  </div>
                  <div class="text-base font-bold text-zinc-100">
                    {{ draftItem.title || $t('itinerary.untitled') }}
                  </div>
                  <div v-if="draftItem.locationName" class="mt-1 text-sm text-zinc-400">
                    {{ draftItem.locationName }}
                  </div>
                  <div
                    v-if="draftItem.note"
                    class="mt-2 whitespace-pre-line rounded-lg bg-zinc-900/70 p-2 text-sm leading-relaxed text-zinc-300"
                  >
                    {{ draftItem.note }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Search Results -->
    <div v-if="searchMode" class="mt-4 animate-fade-in-up">
      <div
        v-if="searchResults.length === 0 && !searchLoading"
        class="glass-card p-8 text-center"
      >
        <p class="text-sm font-medium text-zinc-400">{{ $t('itinerary.noResults') }}</p>
      </div>

      <div v-else class="space-y-3">
        <button
          v-for="it in searchResults"
          :key="it.id"
          class="w-full text-left glass-card p-4 transition-all hover:ring-1 hover:ring-zinc-600 hover:-translate-y-0.5"
          @click="selectSearchResult(it)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="text-base font-semibold text-zinc-100">
              {{ it.title ?? $t('itinerary.untitled') }}
            </div>
            <div class="text-xs font-mono px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">{{ it.dayDate }}</div>
          </div>
          <div v-if="formatTimeRange(it)" class="mt-2 inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
            {{ formatTimeRange(it) }}
          </div>
          <div v-if="it.locationName" class="mt-2 text-sm text-zinc-400 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            {{ it.locationName }}
          </div>
        </button>
      </div>
    </div>

    <!-- Itinerary List -->
    <div v-else class="mt-6 relative">
      <!-- Vertical timeline line -->
      <div v-if="items.length > 0 && !loading" class="absolute left-[27px] top-4 bottom-4 w-0.5 bg-zinc-800/50 rounded-full z-0"></div>

      <div
        v-if="loading"
        class="space-y-4"
      >
        <div v-for="i in 3" :key="i" class="glass-card h-24 animate-pulse"></div>
      </div>

      <div
        v-else-if="errorMsg"
        class="glass-card p-5 text-center"
      >
        <p class="text-sm font-medium text-red-400 mb-4">{{ errorMsg }}</p>
        <button
          class="rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-700 active:scale-95"
          @click="load()"
        >
          {{ $t('itinerary.retry') }}
        </button>
      </div>

      <div
        v-else-if="items.length === 0"
        class="mt-10 animate-fade-in-up"
      >
        <div class="flex flex-col items-center text-center p-8 glass-card border-dashed border-2 border-zinc-800 bg-transparent shadow-none">
          <div class="mb-5 w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center ring-4 ring-zinc-950 shadow-inner">
            <el-icon size="28" class="text-zinc-500">
              <Calendar />
            </el-icon>
          </div>
          <div class="text-lg font-bold text-zinc-200">
            {{ $t('itinerary.noEvents') }}
          </div>
          <div class="mt-2 text-sm text-zinc-500 leading-relaxed max-w-[250px]">
            {{ $t('itinerary.noEventsDesc') }}
          </div>
          <div v-if="canEditData" class="mt-6 flex gap-3 w-full justify-center">
            <button
              class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
              @click="openCreate"
            >
              <el-icon><Plus /></el-icon> Add
            </button>
            <button
              class="flex items-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-700 transition-all hover:bg-zinc-700 active:scale-95"
              @click="openPaste"
            >
              <el-icon><DocumentAdd /></el-icon> Paste
            </button>
          </div>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div v-if="reordering" class="text-xs font-medium text-emerald-400 text-center animate-pulse">
          {{ $t('itinerary.savingOrder') }}
        </div>
        <div v-else-if="reorderError" class="text-xs text-red-400 text-center bg-red-400/10 p-2 rounded-lg">
          {{ reorderError }}
        </div>
        <div v-if="!canEditData" class="text-xs text-zinc-500 text-center mb-4 bg-zinc-900/50 py-2 rounded-lg border border-zinc-800">
          {{ $t('itinerary.viewOnly') }}
        </div>
        
        <div
          v-for="(it, idx) in items"
          :key="it.id"
          class="relative group animate-fade-in-up"
          :style="{ animationDelay: `${idx * 50}ms` }"
        >
          <!-- Timeline dot -->
          <div class="absolute left-6 top-5 w-3 h-3 rounded-full bg-zinc-700 ring-4 ring-zinc-950 z-10 group-hover:bg-emerald-400 transition-colors shadow-[0_0_10px_rgba(52,211,153,0)] group-hover:shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>

          <div class="ml-14 glass-card p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-black/40 group-hover:border-zinc-700/50">
            <!-- Header / Content -->
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    v-if="formatTimeRange(it)"
                    class="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20"
                  >
                    {{ formatTimeRange(it) }}
                  </span>
                </div>

                <div class="min-w-0 break-words whitespace-normal text-lg font-bold text-zinc-100 mb-1">
                  {{ it.title ?? $t('itinerary.untitled') }}
                </div>

                <div
                  v-if="it.locationName"
                  class="mt-2 flex items-center gap-1.5 text-sm text-zinc-400"
                >
                  <svg class="w-4 h-4 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  <span class="break-words whitespace-normal">{{ it.locationName }}</span>
                </div>

                <div
                  v-if="it.note"
                  class="mt-3 text-sm text-zinc-300 whitespace-pre-line leading-relaxed bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50"
                >
                  {{ it.note }}
                </div>
              </div>
            </div>

            <div
              v-if="canEditData"
              class="mt-4 border-t border-zinc-800/50 pt-3"
            >
              <ItineraryItemActions
                :item="it"
                :idx="idx"
                :total="items.length"
                :reordering="reordering"
                @expense="openExpenseFromItinerary"
                @move-up="moveUp"
                @move-down="moveDown"
                @move="askMove"
                @edit="openEdit"
                @delete="askDelete"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Action Buttons -->
    <div
      v-if="canEditData"
      class="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 animate-fade-in-up"
      style="animation-delay: 300ms;"
    >
      <div class="glass flex items-center p-1.5 rounded-full shadow-2xl shadow-emerald-500/20">
        <button
          class="flex items-center justify-center rounded-full w-10 h-10 text-zinc-300 transition-all hover:text-white hover:bg-zinc-800/50 active:scale-95"
          @click="openPaste"
          :title="$t('itinerary.pasteItinerary')"
        >
          <el-icon size="18"><DocumentAdd /></el-icon>
        </button>
        <div class="w-px h-6 bg-zinc-700/50 mx-1"></div>
        <button
          class="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
          @click="openCreate"
        >
          <el-icon size="18"><Plus /></el-icon> {{ $t('itinerary.add') }}
        </button>
      </div>
    </div>

      <BottomSheet
        :open="sheetOpen"
        :title="
          sheetMode === 'edit' ? $t('itinerary.editItem') : $t('itinerary.addItem')
        "
        @close="resetSheet"
      >
        <div
          v-if="createError"
          class="mb-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800"
        >
          <p class="text-sm text-red-300">{{ createError }}</p>
        </div>

        <ItineraryCreateForm
          :day-date="selectedDate"
          :submitting="creating"
          :mode="sheetMode"
          :initial="editingItem"
          @cancel="resetSheet"
          @submit="handleSubmit"
        />
      </BottomSheet>

      <BottomSheet
        :open="pasteOpen"
        title="Paste itinerary"
        @close="closePaste"
      >
        <div
          v-if="pasteError"
          class="mb-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800"
        >
          <p class="text-sm text-red-300">{{ pasteError }}</p>
        </div>

        <div class="space-y-4">
          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('itinerary.date') }}</div>
            <input
              v-model="pasteDayDate"
              type="date"
              class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800 focus:ring-zinc-600"
              :disabled="pasteLoading"
            />
          </label>

          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('itinerary.pasteTextLabel') }}</div>
            <textarea
              v-model="pasteText"
              rows="6"
              :placeholder="$t('itinerary.pasteTextPlaceholder')"
              class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800 focus:ring-zinc-600"
              :disabled="pasteLoading"
            />
          </label>

          <div class="flex gap-2">
            <button
              class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
              :disabled="pasteLoading"
              @click="runPreview"
            >
              {{ pasteLoading ? $t('itinerary.previewing') : $t('itinerary.preview') }}
            </button>
            <button
              class="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
              :disabled="
                pasteLoading ||
                !pastePreview ||
                pastePreview.errors.length > 0 ||
                !/^\d{4}-\d{2}-\d{2}$/.test(pasteDayDate)
              "
              @click="confirmPasteCreate"
            >
              {{ $t('itinerary.create') }}
            </button>
          </div>

          <button
            class="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
            :disabled="pasteLoading"
            @click="closePaste"
          >
            {{ $t('itinerary.cancel') }}
          </button>

          <div v-if="pastePreview" class="space-y-3">
            <div class="text-xs text-zinc-500">{{ $t('itinerary.parsedItems') }}</div>
            <div class="space-y-2">
              <div
                v-for="item in pastePreview.items"
                :key="item.lineNo"
                class="rounded-xl bg-zinc-900 p-3 text-sm ring-1 ring-zinc-800"
              >
                <div class="flex items-center gap-2 text-zinc-100">
                  <span class="text-xs text-zinc-500">#{{ item.lineNo }}</span>
                  <span v-if="item.startTime" class="text-xs text-zinc-400">{{
                    item.startTime
                  }}</span>
                  <span class="font-medium">{{ item.title }}</span>
                </div>
                <div
                  v-if="item.locationName"
                  class="mt-1 text-xs text-zinc-400"
                >
                  {{ item.locationName }}
                </div>
                <div
                  v-if="item.note"
                  class="mt-1 text-xs text-zinc-400 whitespace-pre-line"
                >
                  {{ item.note }}
                </div>
              </div>
            </div>

            <div v-if="pastePreview.errors.length" class="space-y-2">
              <div class="text-xs text-red-300">Errors</div>
              <div
                v-for="err in pastePreview.errors"
                :key="err.lineNo"
                class="rounded-xl bg-zinc-900 p-3 text-xs text-red-300 ring-1 ring-zinc-800"
              >
                <span class="mr-2 text-zinc-500">#{{ err.lineNo }}</span>
                {{ err.message }}
              </div>
            </div>
          </div>
        </div>
      </BottomSheet>

      <div
        v-if="deletingItem"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      >
        <div
          class="w-full max-w-sm rounded-2xl bg-zinc-950 p-4 ring-1 ring-zinc-800"
        >
          <h2 class="text-base font-semibold text-zinc-100">{{ $t('itinerary.deleteConfirmTitle') }}</h2>
          <p class="mt-2 text-sm text-zinc-400">
            {{ $t('itinerary.deleteConfirmDesc') }}
            <span class="text-zinc-100">{{
              deletingItem.title || $t('itinerary.untitled')
            }}</span
            >.
          </p>
          <div class="mt-4 flex gap-2">
            <button
              class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
              @click="deletingItem = null"
            >
              {{ $t('itinerary.cancel') }}
            </button>
            <button
              class="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white"
              @click="confirmDelete"
            >
              {{ $t('itinerary.deleteBtn') }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="movingItem"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      >
        <div
          class="w-full max-w-sm rounded-2xl bg-zinc-950 p-4 ring-1 ring-zinc-800"
        >
          <h2 class="text-base font-semibold text-zinc-100">{{ $t('itinerary.moveTitle') }}</h2>
          <p class="mt-2 text-sm text-zinc-400">
            {{ $t('itinerary.movingDesc') }}
            <span class="text-zinc-100">{{
              movingItem.title || $t('itinerary.untitled')
            }}</span>
          </p>
          <label class="mt-4 block">
            <div class="text-sm text-zinc-300">{{ $t('itinerary.toDate') }}</div>
            <input
              v-model="moveToDate"
              type="date"
              class="mt-2 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800 focus:ring-zinc-600"
              :disabled="moving"
            />
          </label>
          <p v-if="moveError" class="mt-2 text-sm text-red-300">
            {{ moveError }}
          </p>
          <div class="mt-4 flex gap-2">
            <button
              class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
              :disabled="moving"
              @click="cancelMove"
            >
              {{ $t('itinerary.cancel') }}
            </button>
            <button
              class="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
              :disabled="
                moving ||
                !/^\d{4}-\d{2}-\d{2}$/.test(moveToDate) ||
                (movingItem && moveToDate === movingItem.dayDate)
              "
              @click="confirmMove"
            >
              {{ moving ? $t('itinerary.movingBtn') : $t('itinerary.moveBtn') }}
            </button>
          </div>
        </div>
      </div>
  </div>
</template>
