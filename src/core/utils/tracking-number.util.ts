/**
 * Generates sequential tracking numbers in the format AAA-001.
 *
 * Sequence: AAA-001 → AAA-999 → AAB-001 → ... → ZZZ-999
 * Total capacity: 26^3 × 999 = 17,576 × 999 = 17,558,424 unique codes
 */

/**
 * Converts a 0-based sequential index to a tracking number string.
 * index 0 → "AAA-001", index 998 → "AAA-999", index 999 → "AAB-001"
 */
export function indexToTrackingNumber(index: number): string {
  const num = (index % 999) + 1;
  const letterIndex = Math.floor(index / 999);

  const c1 = String.fromCharCode(65 + Math.floor(letterIndex / 676) % 26);
  const c2 = String.fromCharCode(65 + Math.floor(letterIndex / 26) % 26);
  const c3 = String.fromCharCode(65 + letterIndex % 26);

  return `${c1}${c2}${c3}-${String(num).padStart(3, '0')}`;
}

/**
 * Returns the next tracking number given the last one used.
 * If no last number exists, returns "AAA-001".
 */
export function nextTrackingNumber(last: string | null | undefined): string {
  if (!last) return 'AAA-001';

  const match = last.match(/^([A-Z]{3})-(\d{3})$/);
  if (!match) return 'AAA-001';

  const letters = match[1];
  const num = parseInt(match[2], 10);

  const c1 = letters.charCodeAt(0) - 65;
  const c2 = letters.charCodeAt(1) - 65;
  const c3 = letters.charCodeAt(2) - 65;
  const letterIndex = c1 * 676 + c2 * 26 + c3;

  const currentIndex = letterIndex * 999 + (num - 1);
  return indexToTrackingNumber(currentIndex + 1);
}
