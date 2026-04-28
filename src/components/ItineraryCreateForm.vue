<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

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
const { t } = useI18n();

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
    timeError.value = t('itinerary.startTimeInvalid');
    return;
  }
  if (endRaw && !normalizedEnd) {
    timeError.value = t('itinerary.endTimeInvalid');
    return;
  }
  if (!isTimeRangeValid(normalizedStart ?? undefined, normalizedEnd ?? undefined)) {
    timeError.value = t('itinerary.endTimeBeforeStart');
    return;
  }
  const sortRaw = sortOrder.value.trim();
  let sortOrderValue: number | undefined;
  if (sortRaw) {
    const parsed = Number(sortRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      sortOrderError.value = t('itinerary.sortOrderInvalid');
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
      <div class="text-sm text-zinc-300">{{ $t('itinerary.date') }}</div>
      <div class="mt-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800">
        {{ dayDate }}
      </div>
    </div>

    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('itinerary.titleRequired') }}</div>
      <input
        v-model="title"
        :placeholder="$t('itinerary.titlePlaceholder')"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
        @keyup.enter="submit"
      />
      <p v-if="!title.trim()" class="mt-1 text-xs text-zinc-500">{{ $t('itinerary.required') }}</p>
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <div class="text-sm text-zinc-300">{{ $t('itinerary.startTime') }}</div>
        <input
          v-model="startTime"
          type="time"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :disabled="submitting"
        />
      </label>
      <label class="block">
        <div class="text-sm text-zinc-300">{{ $t('itinerary.endTime') }}</div>
        <input
          v-model="endTime"
          type="time"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :disabled="submitting"
        />
      </label>
    </div>

    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('itinerary.locationName') }}</div>
      <input
        v-model="locationName"
        :placeholder="$t('itinerary.locationPlaceholder')"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('itinerary.mapUrl') }}</div>
      <input
        v-model="mapUrl"
        placeholder="https://maps.google.com/..."
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
      <p class="mt-1 text-xs text-zinc-500">{{ $t('itinerary.mapUrlDesc') }}</p>
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('itinerary.note') }}</div>
      <textarea
        v-model="note"
        rows="3"
        :placeholder="$t('itinerary.notePlaceholder')"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('itinerary.sortOrder') }}</div>
      <input
        v-model="sortOrder"
        type="number"
        min="0"
        step="1"
        :placeholder="$t('itinerary.optional')"
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
        {{ $t('itinerary.cancel') }}
      </button>
      <button
        class="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
        :disabled="submitting || !title.trim()"
        @click="submit"
      >
        {{ submitting ? $t('itinerary.saving') : $t('itinerary.save') }}
      </button>
    </div>
  </div>
</template>
