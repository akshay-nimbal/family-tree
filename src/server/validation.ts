// ---------------------------------------------------------------------------
// Input validators
//
// Ported from the Express middleware (backend/src/middleware/validation.ts).
// They used to be connect-style middleware; here we expose pure functions
// that return an array of error messages (empty = valid), which the route
// handlers translate into 400 responses.
// ---------------------------------------------------------------------------

const NAME_PATTERN = /^[\p{L}\p{M}\s'.,-]{1,200}$/u;
const PHONE_PATTERN = /^[+\d\s()-]{6,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^https:\/\/[\w.-]+\.\w+/;
const VALID_REL_TYPES = ["FATHER_OF", "MOTHER_OF", "SPOUSE_OF", "SIBLING_OF"];

export function validatePersonInput(body: unknown): string[] {
  const errors: string[] = [];
  const b = (body || {}) as Record<string, unknown>;

  if (!b.fullName || typeof b.fullName !== "string") {
    errors.push("fullName is required and must be a string");
  } else if (!NAME_PATTERN.test(b.fullName.trim())) {
    errors.push("fullName contains invalid characters");
  }

  if (!b.familyName || typeof b.familyName !== "string") {
    errors.push("familyName is required and must be a string");
  } else if (!NAME_PATTERN.test(b.familyName.trim())) {
    errors.push("familyName contains invalid characters");
  }

  if (b.phone && typeof b.phone === "string" && !PHONE_PATTERN.test(b.phone)) {
    errors.push("phone format is invalid");
  }

  if (b.email && typeof b.email === "string" && !EMAIL_PATTERN.test(b.email)) {
    errors.push("email format is invalid");
  }

  if (
    b.dateOfBirth &&
    typeof b.dateOfBirth === "string" &&
    !DATE_PATTERN.test(b.dateOfBirth)
  ) {
    errors.push("dateOfBirth must be in YYYY-MM-DD format");
  }

  if (
    b.dateOfDeath &&
    typeof b.dateOfDeath === "string" &&
    !DATE_PATTERN.test(b.dateOfDeath)
  ) {
    errors.push("dateOfDeath must be in YYYY-MM-DD format");
  }

  if (
    b.gender &&
    typeof b.gender === "string" &&
    !["male", "female", "other"].includes(b.gender)
  ) {
    errors.push("gender must be male, female, or other");
  }

  if (
    b.linkedinUrl &&
    typeof b.linkedinUrl === "string" &&
    !URL_PATTERN.test(b.linkedinUrl)
  ) {
    errors.push("linkedinUrl must be a valid HTTPS URL");
  }

  return errors;
}

export function validateRelationshipInput(body: unknown): string[] {
  const errors: string[] = [];
  const b = (body || {}) as Record<string, unknown>;

  if (typeof b.fromPersonId !== "string" || !UUID_PATTERN.test(b.fromPersonId)) {
    errors.push("fromPersonId must be a valid UUID");
  }

  if (typeof b.toPersonId !== "string" || !UUID_PATTERN.test(b.toPersonId)) {
    errors.push("toPersonId must be a valid UUID");
  }

  if (typeof b.type !== "string" || !VALID_REL_TYPES.includes(b.type)) {
    errors.push(`type must be one of: ${VALID_REL_TYPES.join(", ")}`);
  }

  if (b.fromPersonId === b.toPersonId) {
    errors.push("Cannot create a relationship with oneself");
  }

  return errors;
}

export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
