// Avoid ambiguous chars: 0/O, 1/I/L
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateRoomCode(length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `GOLF-${code}`;
}

export function normalizeRoomCode(code: string): string {
  const trimmed = code.trim().toUpperCase();
  if (trimmed.startsWith("GOLF-")) return trimmed;
  return `GOLF-${trimmed}`;
}
