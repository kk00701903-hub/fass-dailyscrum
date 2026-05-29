import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export type NoteCategory = "general" | "decision" | "action_item" | "blocker" | "share";

export interface ScrumNote {
  id: string;
  sprintId: string | null;
  noteDate: string;
  title: string;
  content: string;
  category: NoteCategory;
  authorId: string;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScrumNoteInput {
  sprintId?: string | null;
  noteDate: string;
  title: string;
  content: string;
  category: NoteCategory;
  authorId: string;
}

export interface UpdateScrumNoteInput {
  title?: string;
  content?: string;
  category?: NoteCategory;
  isResolved?: boolean;
}

interface DbRow {
  id: string;
  sprint_id: string | null;
  note_date: string;
  title: string;
  content: string;
  category: string;
  author_id: string;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
}

function rowToNote(row: DbRow): ScrumNote {
  return {
    id: row.id,
    sprintId: row.sprint_id,
    noteDate: row.note_date,
    title: row.title,
    content: row.content,
    category: row.category as NoteCategory,
    authorId: row.author_id,
    isResolved: row.is_resolved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchScrumNotesByDate(
  noteDate: string
): Promise<ScrumNote[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase()
    .from("scrum_notes")
    .select("*")
    .eq("note_date", noteDate)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbRow[] ?? []).map(rowToNote);
}

export async function fetchScrumNotesBySprint(
  sprintId: string
): Promise<ScrumNote[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase()
    .from("scrum_notes")
    .select("*")
    .eq("sprint_id", sprintId)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbRow[] ?? []).map(rowToNote);
}

export async function fetchRecentScrumNotes(days = 14): Promise<ScrumNote[]> {
  if (!isSupabaseConfigured()) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const since = cutoff.toISOString().slice(0, 10);

  const { data, error } = await getSupabase()
    .from("scrum_notes")
    .select("*")
    .gte("note_date", since)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbRow[] ?? []).map(rowToNote);
}

export async function createScrumNote(
  input: CreateScrumNoteInput
): Promise<ScrumNote> {
  const { data, error } = await getSupabase()
    .from("scrum_notes")
    .insert({
      sprint_id: input.sprintId ?? null,
      note_date: input.noteDate,
      title: input.title,
      content: input.content,
      category: input.category,
      author_id: input.authorId,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToNote(data as DbRow);
}

export async function updateScrumNote(
  id: string,
  input: UpdateScrumNoteInput
): Promise<ScrumNote> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.content !== undefined) patch.content = input.content;
  if (input.category !== undefined) patch.category = input.category;
  if (input.isResolved !== undefined) patch.is_resolved = input.isResolved;

  const { data, error } = await getSupabase()
    .from("scrum_notes")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToNote(data as DbRow);
}

export async function deleteScrumNote(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("scrum_notes")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
