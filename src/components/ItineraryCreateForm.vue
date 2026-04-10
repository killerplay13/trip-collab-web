<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  dayDate: string; // default selected date
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", payload: {
    title: string;
    startTime?: string;
    endTime?: string;
    locationName?: string;
    mapUrl?: string;
    note?: string;
    sortOrder?: number;
  }): void;
  (e: "cancel"): void;
}>();

const title = ref("");
const startTime = ref("");
const endTime = ref("");
const locationName = ref("");
const mapUrl = ref("");
const note = ref("");
const sortOrder = ref("");
const timeError = ref("");
const sortOrderError = ref("");

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return null;
}

function isTimeRangeValid(start?: string, end?: string) {
  if (!start || !end) return true;
  return end >= start;
}

function submit() {
  timeError.value = "";
  sortOrderError.value = "";
  if (!title.value.trim()) return;
  const startRaw = startTime.value.trim();
  const endRaw = endTime.value.trim();
  const normalizedStart = normalizeTime(startRaw);
  const normalizedEnd = normalizeTime(endRaw);
  if (startRaw && !normalizedStart) {
    timeError.value = "Start time must be HH:mm or HH:mm:ss.";
    return;
  }
  if (endRaw && !normalizedEnd) {
    timeError.value = "End time must be HH:mm or HH:mm:ss.";
    return;
  }
  if (!isTimeRangeValid(normalizedStart ?? undefined, normalizedEnd ?? undefined)) {
    timeError.value = "End time must be after start time.";
    return;
  }
  const sortRaw = sortOrder.value.trim();
  let sortOrderValue: number | undefined;
  if (sortRaw) {
    const parsed = Number(sortRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      sortOrderError.value = "Sort order must be a non-negative integer.";
      return;
    }
    sortOrderValue = parsed;
  }

  emit("submit", {
    title: title.value.trim(),
    startTime: normalizedStart ?? undefined,
    endTime: normalizedEnd ?? undefined,
    locationName: locationName.value.trim() || undefined,
    mapUrl: mapUrl.value.trim() || undefined,
    note: note.value.trim() || undefined,
    sortOrder: sortOrderValue,
  });
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <div class="text-sm text-zinc-300">Date</div>
      <div class="mt-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800">
        {{ dayDate }}
      </div>
    </div>

    <label class="block">
      <div class="text-sm text-zinc-300">Title *</div>
      <input
        v-model="title"
        placeholder="e.g., Tottori Sand Dunes"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
        @keyup.enter="submit"
      />
      <p v-if="!title.trim()" class="mt-1 text-xs text-zinc-500">Required</p>
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <div class="text-sm text-zinc-300">Start time</div>
        <input
          v-model="startTime"
          type="time"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :disabled="submitting"
        />
      </label>
      <label class="block">
        <div class="text-sm text-zinc-300">End time</div>
        <input
          v-model="endTime"
          type="time"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :disabled="submitting"
        />
      </label>
    </div>

    <label class="block">
      <div class="text-sm text-zinc-300">Location name</div>
      <input
        v-model="locationName"
        placeholder="e.g., 砂丘"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">Map URL</div>
      <input
        v-model="mapUrl"
        placeholder="https://maps.google.com/..."
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
      <p class="mt-1 text-xs text-zinc-500">Optional. If provided, the list will show a “Map” button.</p>
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">Note</div>
      <textarea
        v-model="note"
        rows="3"
        placeholder="Any reminders..."
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">Sort order</div>
      <input
        v-model="sortOrder"
        type="number"
        min="0"
        step="1"
        placeholder="Optional"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
    </label>

    <p v-if="timeError" class="text-sm text-red-300">{{ timeError }}</p>
    <p v-if="sortOrderError" class="text-sm text-red-300">{{ sortOrderError }}</p>

    <div class="flex gap-2 pt-1">
      <button
        class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
        :disabled="submitting"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
      <button
        class="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
        :disabled="submitting || !title.trim()"
        @click="submit"
      >
        {{ submitting ? "Saving..." : "Save" }}
      </button>
    </div>
  </div>
</template>
