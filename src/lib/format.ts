/**
 * Format a phone number for display (e.g. 2065551234 → 206-555-1234).
 * Strips non-digits, then applies dashes. Returns original string if not enough digits.
 */
export function formatPhoneDisplay(phone: string | undefined | null): string {
  if (phone == null || phone === "") return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Return digits only for use in tel: href (optional; browsers accept formatted too).
 */
export function formatPhoneTel(phone: string | undefined | null): string {
  if (phone == null || phone === "") return "";
  return phone.replace(/\D/g, "");
}
