import type {
  PersonInput,
  PersonRecord,
  SearchResult,
  FamilyRecord,
  RelationshipInput,
  PersonRelationships,
  RelationshipPath,
  GraphData,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error || body.errors?.join(", ") || `Request failed: ${res.status}`
    );
  }

  return res.json();
}

export const api = {
  createPerson(input: PersonInput): Promise<PersonRecord> {
    return request("/persons", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getPerson(id: string): Promise<PersonRecord> {
    return request(`/persons/${encodeURIComponent(id)}`);
  },

  updatePerson(
    id: string,
    input: Partial<PersonInput>
  ): Promise<PersonRecord> {
    return request(`/persons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  searchPersons(
    query: string,
    familyName?: string,
    limit?: number
  ): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (familyName) params.set("family", familyName);
    if (limit) params.set("limit", String(limit));
    return request(`/persons/search?${params}`);
  },

  checkDuplicates(
    name: string,
    phone?: string,
    email?: string
  ): Promise<SearchResult[]> {
    const params = new URLSearchParams({ name });
    if (phone) params.set("phone", phone);
    if (email) params.set("email", email);
    return request(`/persons/check-duplicates?${params}`);
  },

  getRelationships(personId: string): Promise<PersonRelationships> {
    return request(`/persons/${encodeURIComponent(personId)}/relationships`);
  },

  findPaths(
    personAId: string,
    personBId: string
  ): Promise<RelationshipPath[]> {
    return request(
      `/persons/${encodeURIComponent(personAId)}/paths/${encodeURIComponent(personBId)}`
    );
  },

  createRelationship(input: RelationshipInput): Promise<void> {
    return request("/persons/relationships", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  removeRelationship(input: RelationshipInput): Promise<void> {
    return request("/persons/relationships", {
      method: "DELETE",
      body: JSON.stringify(input),
    });
  },

  mergePersons(keepId: string, mergeId: string): Promise<PersonRecord> {
    return request(
      `/persons/${encodeURIComponent(keepId)}/merge/${encodeURIComponent(mergeId)}`,
      { method: "POST" }
    );
  },

  async uploadPhoto(personId: string, file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await fetch(
      `${API_BASE}/photos/${encodeURIComponent(personId)}`,
      { method: "POST", body: formData }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  getFamilies(): Promise<FamilyRecord[]> {
    return request("/families");
  },

  getGraph(): Promise<GraphData> {
    return request("/families/graph");
  },

  getFamilyMembers(familyName: string): Promise<PersonRecord[]> {
    return request(`/families/${encodeURIComponent(familyName)}/members`);
  },
};
