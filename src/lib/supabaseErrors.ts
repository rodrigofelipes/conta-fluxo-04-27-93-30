export const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { code, message, details, hint } = error as {
    code?: string | number;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  const normalizedCode = typeof code === "string" ? code.toUpperCase() : String(code ?? "").toUpperCase();
  if (["42P01", "PGRST116", "PGRST114", "PGRST210"].includes(normalizedCode)) {
    return true;
  }

  const normalize = (value: unknown) =>
    typeof value === "string" ? value.toLowerCase() : "";

  const combinedText = `${normalize(message)} ${normalize(details)} ${normalize(hint)}`;

  return (
    combinedText.includes("does not exist") ||
    combinedText.includes("not exist") ||
    combinedText.includes("not found") ||
    combinedText.includes("undefined table")
  );
};
