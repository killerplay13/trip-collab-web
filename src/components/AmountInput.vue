<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { parseAmountExpression } from '../utils/formatters';

const props = defineProps<{
  modelValue: string | number;
  disabled?: boolean;
  errorClass?: string;
  defaultClass?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const isFocused = ref(false);

const amount = computed({
  get: () => String(props.modelValue),
  set: (val) => emit('update:modelValue', val)
});

const isValid = computed(() => {
  const value = parseAmountExpression(amount.value);
  return Number.isFinite(value) && value > 0;
});

function insertOperator(op: string) {
  if (props.disabled) return;
  if (!inputRef.value) {
    if (op === 'Backspace') {
      amount.value = amount.value.slice(0, -1);
    } else {
      amount.value += op;
    }
    return;
  }
  const el = inputRef.value;
  const start = el.selectionStart ?? amount.value.length;
  const end = el.selectionEnd ?? amount.value.length;
  amount.value = amount.value.slice(0, start) + op + amount.value.slice(end);
  void nextTick(() => {
    el.focus();
    el.setSelectionRange(start + 1, start + 1);
  });
}

function onBlur() {
  isFocused.value = false;
  if (!amount.value) return;
  const value = parseAmountExpression(amount.value);
  if (Number.isFinite(value) && value > 0) {
    amount.value = String(Number(value.toFixed(2)));
  }
}
</script>

<template>
  <div>
    <input
      ref="inputRef"
      v-model="amount"
      type="text"
      inputmode="decimal"
      :placeholder="placeholder || 'e.g. 100 or 100+50'"
      :class="[
        defaultClass || 'mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 transition-all',
        (amount && !isValid) ? (errorClass || 'ring-red-500/50 focus:ring-red-500') : ''
      ]"
      :disabled="disabled"
      @focus="isFocused = true"
      @blur="onBlur"
    />
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2 scale-y-95"
      enter-to-class="opacity-100 translate-y-0 scale-y-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0 scale-y-100"
      leave-to-class="opacity-0 -translate-y-2 scale-y-95"
    >
      <div v-show="isFocused" class="mt-2 flex flex-wrap gap-1.5 origin-top">
        <button type="button" aria-label="Add" @pointerdown.prevent="insertOperator('+')" class="flex-1 min-h-[2.5rem] min-w-[2rem] rounded-lg bg-zinc-800 text-zinc-200 font-bold hover:bg-zinc-700 active:bg-zinc-600 transition-colors text-lg shadow-sm ring-1 ring-zinc-700/50">+</button>
        <button type="button" aria-label="Subtract" @pointerdown.prevent="insertOperator('-')" class="flex-1 min-h-[2.5rem] min-w-[2rem] rounded-lg bg-zinc-800 text-zinc-200 font-bold hover:bg-zinc-700 active:bg-zinc-600 transition-colors text-lg shadow-sm ring-1 ring-zinc-700/50">-</button>
        <button type="button" aria-label="Multiply" @pointerdown.prevent="insertOperator('*')" class="flex-1 min-h-[2.5rem] min-w-[2rem] rounded-lg bg-zinc-800 text-zinc-200 font-bold hover:bg-zinc-700 active:bg-zinc-600 transition-colors text-lg shadow-sm ring-1 ring-zinc-700/50">×</button>
        <button type="button" aria-label="Divide" @pointerdown.prevent="insertOperator('/')" class="flex-1 min-h-[2.5rem] min-w-[2rem] rounded-lg bg-zinc-800 text-zinc-200 font-bold hover:bg-zinc-700 active:bg-zinc-600 transition-colors text-lg shadow-sm ring-1 ring-zinc-700/50">÷</button>
      </div>
    </transition>
  </div>
</template>
