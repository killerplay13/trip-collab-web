import { computed, ref } from "vue";

type RefreshHandler = () => Promise<void> | void;

export function usePullToRefresh(onRefresh: RefreshHandler) {
  const startY = ref<number | null>(null);
  const pullDistance = ref(0);
  const isRefreshing = ref(false);
  const threshold = 58;
  const maxDistance = 68;

  const isPullActive = computed(() => pullDistance.value > 0 || isRefreshing.value);
  const indicatorStyle = computed(() => ({
    opacity: isPullActive.value ? 1 : 0,
    transform: `translate3d(-50%, ${isRefreshing.value ? 14 : Math.max(0, pullDistance.value - 18)}px, 0)`,
  }));

  function onTouchStart(event: TouchEvent) {
    if (isRefreshing.value || window.scrollY > 0) return;
    startY.value = event.touches[0]?.clientY ?? null;
  }

  function onTouchMove(event: TouchEvent) {
    if (startY.value === null || isRefreshing.value || window.scrollY > 0) return;

    const currentY = event.touches[0]?.clientY ?? startY.value;
    const delta = currentY - startY.value;
    if (delta <= 0) {
      pullDistance.value = 0;
      return;
    }

    if (delta > 8) event.preventDefault();
    pullDistance.value = Math.min(maxDistance, delta * 0.45);
  }

  async function onTouchEnd() {
    if (startY.value === null) return;

    const shouldRefresh = pullDistance.value >= threshold;
    startY.value = null;

    if (!shouldRefresh) {
      pullDistance.value = 0;
      return;
    }

    isRefreshing.value = true;
    pullDistance.value = threshold;
    try {
      await onRefresh();
    } finally {
      isRefreshing.value = false;
      pullDistance.value = 0;
    }
  }

  return {
    isPullActive,
    isRefreshing,
    pullDistance,
    indicatorStyle,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
