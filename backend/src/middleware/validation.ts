import { Request, Response, NextFunction } from "express";

const NAME_PATTERN = /^[\p{L}\p{M}\s'.,-]{1,200}$/u;
const PHONE_PATTERN = /^[+\d\s()-]{6,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^https:\/\/[\w.-]+\.\w+/;

export function validatePersonInput(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  const errors: string[] = [];

  if (!body.fullName || typeof body.fullName !== "string") {
    errors.push("fullName is required and must be a string");
  } else if (!NAME_PATTERN.test(body.fullName.trim())) {
    errors.push("fullName contains invalid characters");
  }

  if (!body.familyName || typeof body.familyName !== "string") {
    errors.push("familyName is required and must be a string");
  } else if (!NAME_PATTERN.test(body.familyName.trim())) {
    errors.push("familyName contains invalid characters");
  }

  if (body.phone && !PHONE_PATTERN.test(body.phone)) {
    errors.push("phone format is invalid");
  }

  if (body.email && !EMAIL_PATTERN.test(body.email)) {
    errors.push("email format is invalid");
  }

  if (body.dateOfBirth && !DATE_PATTERN.test(body.dateOfBirth)) {
    errors.push("dateOfBirth must be in YYYY-MM-DD format");
  }

  if (body.dateOfDeath && !DATE_PATTERN.test(body.dateOfDeath)) {
    errors.push("dateOfDeath must be in YYYY-MM-DD format");
  }

  if (
    body.gender &&
    !["male", "female", "other"].includes(body.gender)
  ) {
    errors.push("gender must be male, female, or other");
  }

  if (body.linkedinUrl && !URL_PATTERN.test(body.linkedinUrl)) {
    errors.push("linkedinUrl must be a valid HTTPS URL");
  }

  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }

  next();
}

export function validateRelationshipInput(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  const errors: string[] = [];
  const validTypes = ["FATHER_OF", "MOTHER_OF", "SPOUSE_OF", "SIBLING_OF"];

  if (!body.fromPersonId || !UUID_PATTERN.test(body.fromPersonId)) {
    errors.push("fromPersonId must be a valid UUID");
  }

  if (!body.toPersonId || !UUID_PATTERN.test(body.toPersonId)) {
    errors.push("toPersonId must be a valid UUID");
  }

  if (!body.type || !validTypes.includes(body.type)) {
    errors.push(`type must be one of: ${validTypes.join(", ")}`);
  }

  if (body.fromPersonId === body.toPersonId) {
    errors.push("Cannot create a relationship with oneself");
  }

  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }

  next();
}

export function validateUUID(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const raw = req.params[paramName];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || !UUID_PATTERN.test(value)) {
      res.status(400).json({ errors: [`${paramName} must be a valid UUID`] });
      return;
    }
    next();
  };
}
