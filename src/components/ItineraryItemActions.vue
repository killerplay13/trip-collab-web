<script setup lang="ts">
import { ArrowDown, ArrowUp, Delete, Edit, Location, Rank } from "@element-plus/icons-vue";
import type { ItineraryItem } from "../types/itinerary";
import { useTripAccess } from "../composables/useTripAccess";

const props = defineProps<{
  item: ItineraryItem;
  idx: number;
  total: number;
  reordering: boolean;
}>();

const emit = defineEmits<{
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
</script>

<template>
  <div
    class="mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-webkit-overflow-scrolling:touch]"
  >
    <el-button
      v-if="props.item.mapUrl"
      size="small"
      text
      :icon="Location"
      :class="actionClass(false)"
      :href="props.item.mapUrl"
      target="_blank"
      rel="noreferrer"
    >
      {{ $t('itinerary.map') }}
    </el-button>
    <el-button
      v-if="canReorderData"
      size="small"
      text
      :icon="ArrowUp"
      :disabled="props.idx === 0 || props.reordering"
      :class="actionClass(props.idx === 0 || props.reordering)"
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
      :class="actionClass(props.idx === props.total - 1 || props.reordering)"
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
      :class="actionClass(false)"
      @click="emit('move', props.item)"
    >
      {{ $t('itinerary.moveBtn') }}
    </el-button>
    <el-button
      size="small"
      text
      :icon="Edit"
      :class="actionClass(false)"
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
      :class="actionClass(false, 'danger')"
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
