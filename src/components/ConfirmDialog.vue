<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

function handleCancel() {
  if (props.loading) return;
  isOpen.value = false;
  emit("cancel");
}

function handleConfirm() {
  if (props.loading) return;
  emit("confirm");
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-all animate-fade-in"
      @click.self="handleCancel"
    >
      <div
        class="w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800 animate-scale-in flex flex-col max-h-[90svh]"
      >
        <div class="overflow-y-auto p-6 flex-1 overscroll-contain">
          <div class="flex flex-col items-center text-center">
            <!-- Icon/Indicator -->
            <div 
              class="mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors"
              :class="danger ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'"
            >
              <svg v-if="danger" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg v-else class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 class="text-xl font-bold text-zinc-100">{{ title }}</h2>
            <p class="mt-3 text-sm leading-relaxed text-zinc-400 whitespace-pre-wrap">
              {{ message }}
            </p>
          </div>
        </div>

        <div class="p-6 pt-0 flex flex-col gap-3 shrink-0">
          <button
            class="group relative flex w-full items-center justify-center overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
            :class="danger ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'"
            :disabled="loading"
            @click="handleConfirm"
          >
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-inherit">
              <svg class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <span :class="{ 'opacity-0': loading }">{{ confirmText || 'Confirm' }}</span>
          </button>

          <button
            class="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
            :disabled="loading"
            @click="handleCancel"
          >
            {{ cancelText || 'Cancel' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}
.animate-scale-in {
  animation: scaleIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
