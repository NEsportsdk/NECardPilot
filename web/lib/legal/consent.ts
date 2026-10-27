export const CURRENT_TERMS_VERSION = "2026-10-23";

export function hasAcceptedCurrentTerms(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    acceptedTerms?: unknown;
    termsVersion?: unknown;
  };

  return (
    candidate.acceptedTerms === true &&
    candidate.termsVersion === CURRENT_TERMS_VERSION
  );
}
