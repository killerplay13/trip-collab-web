<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { getNotes, createNote, updateNote, deleteNote, type Note } from "../api/notes";
import BottomSheet from "../components/BottomSheet.vue";
import NoteForm from "../components/NoteForm.vue";

const route = useRoute();
const { t, locale } = useI18n();
const tripId = computed(() => String(route.params.tripId || ""));

const notes = ref<Note[]>([]);
const loading = ref(false);
const errorMsg = ref("");

const sheetOpen = ref(false);
const editingNote = ref<Note | null>(null);
const formLoading = ref(false);

async function loadNotes() {
  if (!tripId.value) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    notes.value = await getNotes(tripId.value);
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message ?? e?.message ?? "Failed to load notes";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingNote.value = null;
  sheetOpen.value = true;
}

function openEdit(note: Note) {
  editingNote.value = note;
  sheetOpen.value = true;
}

async function handleSubmit(payload: { title: string; content: string }) {
  if (!tripId.value) return;
  formLoading.value = true;
  try {
    if (editingNote.value) {
      await updateNote(tripId.value, editingNote.value.id, payload);
    } else {
      await createNote(tripId.value, payload);
    }
    await loadNotes();
    sheetOpen.value = false;
  } catch (e: any) {
    alert(e?.response?.data?.message ?? e?.message ?? "Failed to save note");
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(note: Note) {
  if (!confirm(t('itinerary.confirmDelete'))) return;
  try {
    await deleteNote(tripId.value, note.id);
    await loadNotes();
  } catch (e: any) {
    alert(e?.response?.data?.message ?? e?.message ?? "Failed to delete note");
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(loadNotes);
</script>

<template>
  <div class="pb-24 animate-fade-in-up">
    <!-- Header Area -->
    <div class="sticky top-0 z-20 -mx-4 px-4 pt-6 pb-4 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 flex flex-col items-center">
      <div class="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 ring-1 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
        <svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-gradient">{{ $t('notes.title') }}</h1>
      <p class="mt-2 text-xs font-mono text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">ID: {{ tripId }}</p>
      
      <button 
        class="mt-6 flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600 active:scale-95"
        @click="openCreate"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        {{ $t('notes.newNote') }}
      </button>
    </div>

    <!-- Notes List -->
    <div class="mt-8 space-y-4 px-1">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="glass-card h-32 animate-pulse"></div>
      </div>

      <div v-else-if="notes.length === 0" class="flex flex-col items-center text-center p-8 glass-card border-dashed border-2 border-zinc-800 bg-transparent shadow-none">
        <div class="mb-5 w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center ring-4 ring-zinc-950 shadow-inner">
          <svg class="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 00-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>
        <div class="text-lg font-bold text-zinc-200">
          {{ $t('notes.noNotes') }}
        </div>
        <div class="mt-2 text-sm text-zinc-500 leading-relaxed max-w-[250px]">
          {{ $t('notes.noNotesDesc') }}
        </div>
      </div>

      <div
        v-for="note in notes"
        :key="note.id"
        class="glass-card group p-5 transition-all hover:border-zinc-600"
      >
        <div class="flex justify-between items-start mb-3">
          <h3 class="text-lg font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">{{ note.title }}</h3>
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              class="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              @click="openEdit(note)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            </button>
            <button 
              class="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              @click="handleDelete(note)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>
        <div class="text-sm text-zinc-400 line-clamp-3 mb-4 whitespace-pre-wrap">{{ note.content }}</div>
        <div class="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {{ formatDate(note.updatedAt) }}
        </div>
      </div>
    </div>

    <!-- Create/Edit Sheet -->
    <BottomSheet
      :open="sheetOpen"
      :title="editingNote ? (locale === 'zh-TW' ? '編輯筆記' : 'Edit Note') : $t('notes.newNote')"
      @close="sheetOpen = false"
    >
      <NoteForm
        :initial-title="editingNote?.title"
        :initial-content="editingNote?.content"
        :loading="formLoading"
        @cancel="sheetOpen = false"
        @submit="handleSubmit"
      />
    </BottomSheet>
  </div>
</template>
