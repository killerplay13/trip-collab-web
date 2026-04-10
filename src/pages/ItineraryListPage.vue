<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, ArrowRight, Calendar, DocumentAdd, Plus } from "@element-plus/icons-vue";
import {
  createItineraryItem,
  deleteItineraryItem,
  getItineraryByDate,
  moveItineraryItem,
  pasteCreateItinerary,
  pastePreviewItinerary,
  patchItineraryItem,
  reorderItinerary,
  searchItineraryItems,
} from "../api/itinerary";
import type { PastePreviewResult } from "../api/itinerary";
import type { ItineraryItem } from "../types/itinerary";
import BottomSheet from "../components/BottomSheet.vue";
import ItineraryCreateForm from "../components/ItineraryCreateForm.vue";
import ItineraryItemActions from "../components/ItineraryItemActions.vue";
import { useTripAccess } from "../composables/useTripAccess";

const route = useRoute();
const router = useRouter();
const { canEditData } = useTripAccess();

const tripId = computed(() => String(route.params.tripId || ""));

// --- date utilities (no external libs) ---
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(ymd: string, delta: number) {
  const [y = new Date().getFullYear(), m = 1, day = 1] = ymd
    .split("-")
    .map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + delta);
  return toYmd(d);
}

const selectedDate = computed<string>(() => {
  const q = route.query.date;
  if (typeof q === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return toYmd(new Date()); // v0.1: default today (later we can use trip.startDate)
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

function formatTimeRange(item: ItineraryItem) {
  const start = item.startTime ? item.startTime.slice(0, 5) : "";
  const end = item.endTime ? item.endTime.slice(0, 5) : "";
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

async function load() {
  if (!tripId.value) return;
  loading.value = true;
  errorMsg.value = "";
  reorderError.value = null;
  try {
    const res = await getItineraryByDate(tripId.value, selectedDate.value);
    items.value = Array.isArray(res) ? res : [];
  } catch (e: any) {
    errorMsg.value =
      e?.response?.data?.message ?? e?.message ?? "Failed to load itinerary";
    items.value = [];
  } finally {
    loading.value = false;
  }
}

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
      e?.response?.data?.message ?? e?.message ?? "Failed to save order.";
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

async function prevDay() {
  await goDate(addDays(selectedDate.value, -1));
}
async function nextDay() {
  await goDate(addDays(selectedDate.value, +1));
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
      e?.response?.data?.message ?? e?.message ?? "Create failed";
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
      e?.response?.data?.message ?? e?.message ?? "Update failed";
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
      e?.response?.data?.message ?? e?.message ?? "Delete failed";
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
      "Move failed. Please try again.";
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
      "Preview failed. Please try again.";
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
      "Paste failed. Please try again.";
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
      "Search failed. Please try again.";
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

onMounted(load);
watch(() => selectedDate.value, load);
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
  <div>
    <div class="space-y-4">
      <label class="block">
        <div class="text-sm text-zinc-300">Search</div>
        <div class="relative mt-1">
          <input
            v-model="searchQuery"
            placeholder="Search itinerary (title, location, note)..."
            class="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800 focus:ring-zinc-600"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400"
            @click="searchQuery = ''"
            type="button"
            aria-label="Clear search"
          >
            ×
          </button>
        </div>
      </label>
      <div v-if="searchLoading" class="text-xs text-zinc-500">Searching...</div>
      <div v-else-if="searchError" class="text-xs text-red-300">
        {{ searchError }}
      </div>
    </div>

    <div v-if="searchMode" class="mt-4">
      <div
        v-if="searchResults.length === 0 && !searchLoading"
        class="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
      >
        <p class="text-sm text-zinc-300">No results.</p>
      </div>

      <div v-else class="space-y-3">
        <button
          v-for="it in searchResults"
          :key="it.id"
          class="w-full rounded-2xl bg-zinc-900 p-4 text-left ring-1 ring-zinc-800"
          @click="selectSearchResult(it)"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="text-base font-medium text-zinc-100">
              {{ it.title ?? "Untitled" }}
            </div>
            <div class="text-xs text-zinc-500">{{ it.dayDate }}</div>
          </div>
          <div v-if="formatTimeRange(it)" class="mt-1 text-sm text-zinc-400">
            {{ formatTimeRange(it) }}
          </div>
          <div v-if="it.locationName" class="mt-1 text-sm text-zinc-400">
            {{ it.locationName }}
          </div>
        </button>
      </div>
    </div>

    <div v-else class="mt-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">Itinerary</h1>
          <p class="mt-1 text-sm text-zinc-400">{{ selectedDate }}</p>
        </div>

        <div class="flex gap-2">
          <el-button
            size="small"
            class="bg-zinc-900 ring-1 ring-zinc-800 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            :icon="ArrowLeft"
            @click="prevDay"
          />
          <el-button
            size="small"
            class="bg-zinc-900 ring-1 ring-zinc-800 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            :icon="ArrowRight"
            @click="nextDay"
          />
        </div>
      </div>

      <div class="mt-4">
        <div
          v-if="loading"
          class="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
        >
          <p class="text-sm text-zinc-300">Loading...</p>
        </div>

        <div
          v-else-if="errorMsg"
          class="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
        >
          <p class="text-sm text-red-300">{{ errorMsg }}</p>
          <button
            class="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-900"
            @click="load"
          >
            Retry
          </button>
        </div>

        <div
          v-else-if="items.length === 0"
          class="rounded-2xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800/50"
        >
          <div class="flex flex-col items-center text-center">
            <div class="mb-3 rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-zinc-800/50">
              <el-icon size="28">
                <Calendar />
              </el-icon>
            </div>
            <div class="text-base font-semibold text-zinc-100">
              No itinerary for this day
            </div>
            <div class="mt-1 text-sm text-zinc-400">
              {{ canEditData ? "Add an item or paste a plan to get started." : "View only. You need trip access to edit this itinerary." }}
            </div>
            <div v-if="canEditData" class="mt-4 flex gap-2">
              <el-button
                size="small"
                type="primary"
                :icon="Plus"
                class="transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                @click="openCreate"
              >
                Add
              </el-button>
              <el-button
                size="small"
                :icon="DocumentAdd"
                class="bg-zinc-900/70 text-zinc-200 ring-1 ring-zinc-800/60 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                @click="openPaste"
              >
                Paste
              </el-button>
            </div>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div v-if="reordering" class="text-xs text-zinc-500">
            Saving order...
          </div>
          <div v-else-if="reorderError" class="text-xs text-red-300">
            {{ reorderError }}
          </div>
          <div v-if="!canEditData" class="text-xs text-zinc-500">
            View only. You need trip access to edit this itinerary.
          </div>
          <div
            v-for="(it, idx) in items"
            :key="it.id"
            class="rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-zinc-800/60 transition-colors duration-150 hover:ring-zinc-700/70"
          >
            <!-- Header / Content -->
            <div class="flex items-start gap-3">
              <!-- Left: Main info -->
              <div class="min-w-0 flex-1">
                <!-- time badge + title -->
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    v-if="formatTimeRange(it)"
                    class="inline-flex items-center rounded-full bg-zinc-800/60 px-2 py-0.5 text-xs font-medium text-zinc-200 ring-1 ring-zinc-700/50"
                  >
                    {{ formatTimeRange(it) }}
                  </span>

                  <div
                    class="min-w-0 truncate text-base font-semibold text-zinc-100"
                  >
                    {{ it.title ?? "Untitled" }}
                  </div>
                </div>

                <!-- location -->
                <div
                  v-if="it.locationName"
                  class="mt-1 flex items-center gap-1.5 text-sm text-zinc-500"
                >
                  <span class="inline-flex">
                    <!-- small dot icon feel; keep simple to avoid extra icon dependency -->
                    <span class="h-1.5 w-1.5 rounded-full bg-zinc-600/70"></span>
                  </span>
                  <span class="truncate">{{ it.locationName }}</span>
                </div>

                <!-- note -->
                <div
                  v-if="it.note"
                  class="mt-2 text-sm text-zinc-300 whitespace-pre-line"
                >
                  {{ it.note }}
                </div>
              </div>

            </div>

            <ItineraryItemActions
              v-if="canEditData"
              :item="it"
              :idx="idx"
              :total="items.length"
              :reordering="reordering"
              @move-up="moveUp"
              @move-down="moveDown"
              @move="askMove"
              @edit="openEdit"
              @delete="askDelete"
            />
          </div>
        </div>
      </div>
      <!-- Floating Add/Paste Buttons -->
      <div
        v-if="canEditData"
        class="fixed bottom-24 right-4 z-40 flex gap-2"
        style="margin-bottom: env(safe-area-inset-bottom)"
      >
        <el-button
          size="default"
          class="bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          :icon="DocumentAdd"
          @click="openPaste"
        >
          Paste
        </el-button>
        <el-button
          size="default"
          type="primary"
          circle
          :icon="Plus"
          class="transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          @click="openCreate"
        />
      </div>

      <BottomSheet
        :open="sheetOpen"
        :title="
          sheetMode === 'edit' ? 'Edit itinerary item' : 'Add itinerary item'
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
            <div class="text-sm text-zinc-300">Date</div>
            <input
              v-model="pasteDayDate"
              type="date"
              class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800 focus:ring-zinc-600"
              :disabled="pasteLoading"
            />
          </label>

          <label class="block">
            <div class="text-sm text-zinc-300">Paste text</div>
            <textarea
              v-model="pasteText"
              rows="6"
              placeholder="09:00 Breakfast at hotel\n10:30 Museum visit"
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
              {{ pasteLoading ? "Previewing..." : "Preview" }}
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
              Create
            </button>
          </div>

          <button
            class="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
            :disabled="pasteLoading"
            @click="closePaste"
          >
            Cancel
          </button>

          <div v-if="pastePreview" class="space-y-3">
            <div class="text-xs text-zinc-500">Parsed items</div>
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
          <h2 class="text-base font-semibold text-zinc-100">Delete item?</h2>
          <p class="mt-2 text-sm text-zinc-400">
            This will delete
            <span class="text-zinc-100">{{
              deletingItem.title || "Untitled"
            }}</span
            >.
          </p>
          <div class="mt-4 flex gap-2">
            <button
              class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
              @click="deletingItem = null"
            >
              Cancel
            </button>
            <button
              class="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white"
              @click="confirmDelete"
            >
              Delete
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
          <h2 class="text-base font-semibold text-zinc-100">Move item</h2>
          <p class="mt-2 text-sm text-zinc-400">
            Moving
            <span class="text-zinc-100">{{
              movingItem.title || "Untitled"
            }}</span>
          </p>
          <label class="mt-4 block">
            <div class="text-sm text-zinc-300">To date</div>
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
              Cancel
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
              {{ moving ? "Moving..." : "Move" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
