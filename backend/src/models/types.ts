export interface PersonInput {
  fullName: string;
  familyName: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  gender?: "male" | "female" | "other";
  city?: string;
  occupation?: string;
  education?: string;
  phone?: string;
  email?: string;
  linkedinUrl?: string;
  additionalNotes?: string;
  /** "verified" = person entered their own data; "pending" = created as a reference by someone else */
  status?: "verified" | "pending";
}

export interface PersonRecord extends PersonInput {
  id: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type RelationshipType =
  | "FATHER_OF"
  | "MOTHER_OF"
  | "SPOUSE_OF"
  | "SIBLING_OF";

export interface RelationshipInput {
  fromPersonId: string;
  toPersonId: string;
  type: RelationshipType;
  marriageDate?: string;
}

export interface FamilyRecord {
  id: string;
  name: string;
  description?: string;
}

export interface SearchResult {
  person: PersonRecord;
  score: number;
  matchReason: string;
}
