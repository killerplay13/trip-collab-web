<script setup lang="ts">
import { ArrowDown, ArrowUp, Delete, Edit, Location, Money, Rank } from "@element-plus/icons-vue";
import type { ItineraryItem } from "../types/itinerary";
import { useTripAccess } from "../composables/useTripAccess";

const props = defineProps<{
  item: ItineraryItem;
  idx: number;
  total: number;
  reordering: boolean;
}>();

const emit = defineEmits<{
  (e: "expense", item: ItineraryItem): void;
  (e: "move-up", idx: number): void;
  (e: "move-down", idx: number): void;
  (e: "move", item: ItineraryItem): void;
  (e: "edit", item: ItineraryItem): void;
  (e: "delete", item: ItineraryItem): void;
}>();

const { canDeleteData, canReorderData } = useTripAccess();

const actionBase =
  "rounded-full px-3 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";
const actionEnabled = "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/40";
const actionDisabled =
  "opacity-40 text-zinc-500 cursor-not-allowed hover:bg-transparent hover:text-zinc-500";
const actionDanger = "text-red-400 hover:text-red-300 hover:bg-red-500/10";

function actionClass(disabled: boolean, tone: "normal" | "danger" = "normal") {
  return [
    actionBase,
    disabled ? actionDisabled : tone === "danger" ? actionDanger : actionEnabled,
  ];
}

function normalizeMapHref(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "#";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}
</script>

<template>
  <div
    class="flex w-full items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
  >
    <button
      type="button"
      class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/20 transition-all hover:bg-emerald-500/20 hover:text-emerald-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      @click="emit('expense', props.item)"
    >
      <el-icon><Money /></el-icon>
      {{ $t('itinerary.addExpense') }}
    </button>

    <a
      v-if="props.item.mapUrl"
      :href="normalizeMapHref(props.item.mapUrl)"
      target="_blank"
      rel="noreferrer"
      :class="[actionClass(false), 'inline-flex h-8 shrink-0 items-center gap-1.5 text-sm no-underline']"
    >
      <el-icon><Location /></el-icon>
      {{ $t('itinerary.map') }}
    </a>
    <el-button
      v-if="canReorderData"
      size="small"
      text
      :icon="ArrowUp"
      :disabled="props.idx === 0 || props.reordering"
      :class="[actionClass(props.idx === 0 || props.reordering), 'shrink-0']"
      @click="emit('move-up', props.idx)"
    >
      {{ $t('itinerary.up') }}
    </el-button>
    <el-button
      v-if="canReorderData"
      size="small"
      text
      :icon="ArrowDown"
      :disabled="props.idx === props.total - 1 || props.reordering"
      :class="[actionClass(props.idx === props.total - 1 || props.reordering), 'shrink-0']"
      @click="emit('move-down', props.idx)"
    >
      {{ $t('itinerary.down') }}
    </el-button>
    <div v-if="canReorderData || canDeleteData" class="mx-1 h-4 w-px bg-zinc-800/50"></div>
    <el-button
      v-if="canReorderData"
      size="small"
      text
      :icon="Rank"
      :class="[actionClass(false), 'shrink-0']"
      @click="emit('move', props.item)"
    >
      {{ $t('itinerary.moveBtn') }}
    </el-button>
    <el-button
      size="small"
      text
      :icon="Edit"
      :class="[actionClass(false), 'shrink-0']"
      @click="emit('edit', props.item)"
    >
      {{ $t('itinerary.editItem') }}
    </el-button>
    <el-button
      v-if="canDeleteData"
      size="small"
      text
      type="danger"
      :icon="Delete"
      :class="[actionClass(false, 'danger'), 'shrink-0']"
      @click="emit('delete', props.item)"
    >
      {{ $t('itinerary.deleteBtn') }}
    </el-button>
  </div>
</template>

<style scoped>
.el-button.is-disabled {
  opacity: 0.4;
}
.el-button.is-disabled:hover {
  background: transparent;
}
</style>
