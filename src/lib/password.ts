/**
 * The password as it is hashed and verified. Every place that sets or checks a password goes through this, so the
 * same keystrokes always match: NFC because one "é" can arrive as one code point or two depending on the device, and
 * the outer whitespace is dropped as a mistyping allowance (NIST SP 800-63B-4 §3.1.1.2 allows both). Inner spaces
 * stay, so passphrases work.
 */
export function toNormalizedPassword(value: string): string {
  return value.normalize("NFC").trim();
}
