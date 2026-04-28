<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  initialTitle?: string;
  initialContent?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", payload: { title: string; content: string }): void;
  (e: "cancel"): void;
}>();

const title = ref(props.initialTitle || "");
const content = ref(props.initialContent || "");

watch(() => props.initialTitle, (v) => title.value = v || "");
watch(() => props.initialContent, (v) => content.value = v || "");

function handleSubmit() {
  if (!title.value.trim()) return;
  emit("submit", { title: title.value.trim(), content: content.value.trim() });
}
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('settings.tripName') }}</label>
      <input
        v-model="title"
        type="text"
        :placeholder="$t('settings.tripName')"
        class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
      />
    </div>

    <div class="space-y-2">
      <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('home.notes') }}</label>
      <textarea
        v-model="content"
        rows="8"
        :placeholder="$t('home.notesDesc')"
        class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none"
      ></textarea>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        class="flex-1 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-semibold border border-zinc-800 transition-all hover:bg-zinc-800 active:scale-95"
        @click="$emit('cancel')"
      >
        {{ $t('itinerary.cancel') }}
      </button>
      <button
        class="flex-1 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-semibold shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        :disabled="loading || !title.trim()"
        @click="handleSubmit"
      >
        <span v-if="loading">...</span>
        <span v-else>{{ $t('settings.save') }}</span>
      </button>
    </div>
  </div>
</template>
