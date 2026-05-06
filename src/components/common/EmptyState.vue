<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  actionText?: string;
  secondaryActionText?: string;
  loading?: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  (e: 'action'): void;
  (e: 'secondary-action'): void;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 text-center animate-fade-in-up">
    <!-- Icon Slot -->
    <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900/50 text-zinc-500 ring-1 ring-zinc-800/50 shadow-inner">
      <slot name="icon">
        <svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </slot>
    </div>

    <!-- Content -->
    <h3 class="text-xl font-bold text-zinc-100 break-words whitespace-normal leading-tight">
      {{ title }}
    </h3>
    <p v-if="description" class="mt-3 max-w-xs text-sm leading-relaxed text-zinc-500 break-words whitespace-normal">
      {{ description }}
    </p>

    <!-- Actions -->
    <div class="mt-8 flex flex-col gap-3 w-full max-w-[240px]">
      <slot name="action">
        <button
          v-if="actionText"
          type="button"
          class="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          :disabled="loading || disabled"
          @click="$emit('action')"
        >
          <span v-if="loading" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
          {{ actionText }}
        </button>
      </slot>

      <slot name="secondary-action">
        <button
          v-if="secondaryActionText"
          type="button"
          class="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-400 ring-1 ring-zinc-800 transition-all hover:bg-zinc-800 hover:text-zinc-200 active:scale-95"
          :disabled="loading || disabled"
          @click="$emit('secondary-action')"
        >
          {{ secondaryActionText }}
        </button>
      </slot>
    </div>
  </div>
</template>
