import { api } from "./client";

export type Note = {
  id: string;
  tripId: string;
  authorId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNotePayload = {
  title: string;
  content: string;
};

export type UpdateNotePayload = {
  title?: string;
  content?: string;
};

export async function getNotes(tripId: string): Promise<Note[]> {
  const res = await api.get<Note[]>(`/api/trips/${tripId}/notes`);
  return res.data;
}

export async function createNote(tripId: string, payload: CreateNotePayload): Promise<Note> {
  const res = await api.post<Note>(`/api/trips/${tripId}/notes`, payload);
  return res.data;
}

export async function updateNote(tripId: string, noteId: string, payload: UpdateNotePayload): Promise<Note> {
  const res = await api.patch<Note>(`/api/trips/${tripId}/notes/${noteId}`, payload);
  return res.data;
}

export async function deleteNote(tripId: string, noteId: string): Promise<void> {
  await api.delete(`/api/trips/${tripId}/notes/${noteId}`);
}
