// Keep in sync with private.valid_review_url in the Phase 2 migration.
// Only review-specific URLs; no general Google redirect/share endpoints.
export function isGoogleReviewUrl(value: string) {
  if (value.length > 2048 || /[\r\n]/.test(value)) return false;
  return (
    /^https:\/\/g[.]page\/(r\/)?[A-Za-z0-9_-]+\/review$/.test(value) ||
    /^https:\/\/search[.]google[.]com\/local\/writereview[?]placeid=[A-Za-z0-9_%-]+$/.test(
      value,
    )
  );
}
