const FULL_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' -]*[\p{L}\p{M}]$/u;
const USERNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,29}$/u;

export const PASSWORD_REQUIREMENTS =
  "Password must be 8-72 characters and include an uppercase letter, lowercase letter, number, and special character.";

export function normalizeFullName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function normalizeUsername(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidFullName(value: string): boolean {
  return value.length >= 2 && value.length <= 80 && FULL_NAME_PATTERN.test(value);
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function isStrongPassword(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 8
    && value.length <= 72
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9\s]/.test(value)
    && !/\s/.test(value);
}