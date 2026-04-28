<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps<{
  open: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (v) => {
    // prevent background scrolling when open
    document.body.style.overflow = v ? "hidden" : "";
  },
  { immediate: true }
);

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50">
      <!-- Backdrop -->
      <button
        class="absolute inset-0 bg-black/60"
        aria-label="Close"
        @click="$emit('close')"
      />

      <!-- Sheet -->
      <div
        class="absolute bottom-0 left-0 right-0 mx-auto flex max-h-[calc(100svh-1rem)] max-w-md flex-col rounded-t-3xl bg-zinc-950 ring-1 ring-zinc-800"
        style="padding-bottom: env(safe-area-inset-bottom)"
      >
        <div class="flex shrink-0 items-center justify-between px-4 pt-4">
          <div class="text-base font-semibold">
            {{ title || "Sheet" }}
          </div>
          <button
            class="rounded-xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800"
            @click="$emit('close')"
          >
            Close
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
