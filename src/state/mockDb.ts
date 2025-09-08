/* This file centralizes simple, in-memory demo data. Replace with API calls later. */
export type Status = "PENDENTE" | "EM_ANALISE" | "APROVADO" | "DEVOLVIDO";

export interface Category { id: string; name: string; color?: string }
export const categories: Category[] = [
  { id: "cat1", name: "Impostos" },
  { id: "cat2", name: "Folha" },
  { id: "cat3", name: "Balanço" },
  { id: "cat4", name: "Contratos" },
  { id: "cat5", name: "Outros" },
];
