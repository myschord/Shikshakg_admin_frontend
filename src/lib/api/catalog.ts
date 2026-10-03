import { api } from "./client";
import type { components } from "./schema";

type S = components["schemas"];

export type ExamCategory = S["CategoryOut"];
export type Exam = S["ExamOut"];
export type ExamStage = S["StageOut"];

// Public catalog reads, used for the exam and stage pickers.
export const catalogApi = {
  categories: () => api.get<ExamCategory[]>("/exam-categories", { auth: "none" }),
  exam: (slug: string) => api.get<Exam>(`/exams/${encodeURIComponent(slug)}`, { auth: "none" }),
};
