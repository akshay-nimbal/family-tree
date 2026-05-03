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

export interface SearchResult {
  person: PersonRecord;
  score: number;
  matchReason: string;
}

export interface FamilyRecord {
  id: string;
  name: string;
  memberCount: number;
}

export interface PersonRelationships {
  father: PersonRecord | null;
  mother: PersonRecord | null;
  spouses: PersonRecord[];
  children: PersonRecord[];
  siblings: PersonRecord[];
}

export interface RelationshipPath {
  path: string[];
  relationships: string[];
}

export interface GraphNode {
  id: string;
  fullName: string;
  familyName: string;
  gender: string | null;
  status: string;
  city: string | null;
  occupation: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  photoUrl: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  families: string[];
}
