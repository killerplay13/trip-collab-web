<script setup lang="ts">
import { useToast } from "../../composables/useToast";

const { toasts, remove } = useToast();

function getToastIcon(type: string) {
  switch (type) {
    case "success":
      return "check_circle";
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
    default:
      return "info";
  }
}

function getToastClasses(type: string) {
  switch (type) {
    case "success":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "error":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "warning":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "info":
    default:
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }
}

function getIconColor(type: string) {
  switch (type) {
    case "success":
      return "text-emerald-500";
    case "error":
      return "text-red-500";
    case "warning":
      return "text-amber-500";
    case "info":
    default:
      return "text-blue-500";
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed bottom-4 left-4 right-4 z-[10000] flex flex-col gap-3 sm:left-auto sm:right-4 sm:w-96"
    >
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-2 opacity-0 sm:translate-x-4 sm:translate-y-0"
        enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl"
          :class="getToastClasses(toast.type)"
          :role="toast.type === 'error' ? 'alert' : 'status'"
          :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
        >
          <div class="flex flex-1 items-start gap-3 p-4">
            <!-- Icon -->
            <div class="mt-0.5 shrink-0" :class="getIconColor(toast.type)">
              <svg
                v-if="toast.type === 'success'"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <svg
                v-else-if="toast.type === 'error'"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <svg
                v-else-if="toast.type === 'warning'"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <svg
                v-else
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <!-- Content -->
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold break-words whitespace-normal leading-relaxed">
                {{ toast.message }}
              </p>
              <p
                v-if="toast.description"
                class="mt-1 text-xs opacity-80 break-words whitespace-normal leading-relaxed"
              >
                {{ toast.description }}
              </p>
              
              <!-- Action Button -->
              <div v-if="toast.actionText && toast.onAction" class="mt-3">
                <button
                  type="button"
                  class="rounded-lg bg-zinc-900/50 px-3 py-1.5 text-xs font-bold ring-1 ring-white/10 transition-all hover:bg-zinc-900 active:scale-95"
                  @click="toast.onAction(); remove(toast.id)"
                >
                  {{ toast.actionText }}
                </button>
              </div>
            </div>

            <!-- Close Button -->
            <button
              type="button"
              class="ml-2 shrink-0 opacity-50 transition-opacity hover:opacity-100"
              @click="remove(toast.id)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/* Ensure the container doesn't block clicks to elements behind it */
.pointer-events-none {
  pointer-events: none;
}
.pointer-events-auto {
  pointer-events: auto;
}
</style>
