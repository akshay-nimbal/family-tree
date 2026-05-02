import { useState } from "react";
import { api } from "../api/client";
import { PersonSearch } from "./PersonSearch";
import type {
  PersonInput,
  PersonRecord,
  RelationshipType,
} from "../types";

interface PendingRelationship {
  person: PersonRecord;
  type: RelationshipType;
}

const FAMILY_NAMES = [
  "Select a family...",
  "Add new family...",
];

interface PersonFormProps {
  families: string[];
  onPersonCreated: (person: PersonRecord) => void;
}

export function PersonForm({ families, onPersonCreated }: PersonFormProps) {
  const allFamilyOptions = [...FAMILY_NAMES.slice(0, 1), ...families, FAMILY_NAMES[1]];

  const [form, setForm] = useState<PersonInput>({
    fullName: "",
    familyName: "",
  });
  const [customFamily, setCustomFamily] = useState("");
  const [showCustomFamily, setShowCustomFamily] = useState(false);
  const [father, setFather] = useState<PersonRecord | null>(null);
  const [mother, setMother] = useState<PersonRecord | null>(null);
  const [spouse, setSpouse] = useState<PersonRecord | null>(null);
  const [children, setChildren] = useState<PersonRecord[]>([]);
  const [siblings, setSiblings] = useState<PersonRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PersonRecord | null>(null);

  function updateField(field: keyof PersonInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value || undefined }));
  }

  function handleFamilyChange(value: string) {
    if (value === "Add new family...") {
      setShowCustomFamily(true);
      setForm((prev) => ({ ...prev, familyName: "" }));
    } else {
      setShowCustomFamily(false);
      setForm((prev) => ({ ...prev, familyName: value }));
    }
  }

  async function createPendingPerson(
    name: string,
    relType: RelationshipType,
    setter: (p: PersonRecord) => void
  ) {
    try {
      const pending = await api.createPerson({
        fullName: name,
        familyName: form.familyName || customFamily,
        status: "pending",
      });
      setter(pending);
    } catch (err) {
      setError(
        `Failed to create pending record: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const input: PersonInput = {
        ...form,
        familyName: showCustomFamily ? customFamily.trim() : form.familyName,
        status: "verified",
      };

      const person = await api.createPerson(input);

      const relationships: PendingRelationship[] = [];
      if (father) relationships.push({ person: father, type: "FATHER_OF" });
      if (mother) relationships.push({ person: mother, type: "MOTHER_OF" });
      if (spouse) relationships.push({ person: spouse, type: "SPOUSE_OF" });
      for (const child of children) {
        relationships.push({ person: child, type: "FATHER_OF" });
      }
      for (const sib of siblings) {
        relationships.push({ person: sib, type: "SIBLING_OF" });
      }

      for (const rel of relationships) {
        const isParentRel =
          rel.type === "FATHER_OF" || rel.type === "MOTHER_OF";
        const fromId = isParentRel
          ? rel.type === "FATHER_OF" && rel.person === father
            ? rel.person.id
            : rel.type === "MOTHER_OF" && rel.person === mother
            ? rel.person.id
            : person.id
          : person.id;
        const toId = isParentRel
          ? rel.person === father || rel.person === mother
            ? person.id
            : rel.person.id
          : rel.person.id;

        await api.createRelationship({
          fromPersonId: fromId,
          toPersonId: toId,
          type: rel.type,
        });
      }

      setSuccess(person);
      onPersonCreated(person);

      setForm({ fullName: "", familyName: form.familyName });
      setFather(null);
      setMother(null);
      setSpouse(null);
      setChildren([]);
      setSiblings([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const activeFamilyName = showCustomFamily ? customFamily : form.familyName;

  return (
    <div className="person-form-container">
      <h2>Add Family Member</h2>
      <p className="form-description">
        Enter your details below. When linking family members, search for
        existing records to maintain accurate connections. If a person hasn't
        registered yet, create a pending record that they can claim later.
      </p>

      {success && (
        <div className="alert alert-success">
          Successfully added <strong>{success.fullName}</strong> (ID:{" "}
          {success.id.slice(0, 8)}...). They can share this ID to let others
          link to their record.
          <button
            type="button"
            className="btn-clear"
            onClick={() => setSuccess(null)}
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
          <button
            type="button"
            className="btn-clear"
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Personal Information</legend>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="familyName">Family Name *</label>
              <select
                id="familyName"
                value={
                  showCustomFamily ? "Add new family..." : form.familyName || "Select a family..."
                }
                onChange={(e) => handleFamilyChange(e.target.value)}
                required
              >
                {allFamilyOptions.map((f) => (
                  <option key={f} value={f} disabled={f === "Select a family..."}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {showCustomFamily && (
              <div className="field">
                <label htmlFor="customFamily">New Family Name *</label>
                <input
                  id="customFamily"
                  type="text"
                  value={customFamily}
                  onChange={(e) => setCustomFamily(e.target.value)}
                  placeholder="Enter family surname"
                  required
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="fullName">Full Name *</label>
              <input
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                placeholder="e.g., Ramesh Kumar Sharma"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                value={form.gender || ""}
                onChange={(e) =>
                  updateField("gender", e.target.value)
                }
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="dob">Date of Birth</label>
              <input
                id="dob"
                type="date"
                value={form.dateOfBirth || ""}
                onChange={(e) => updateField("dateOfBirth", e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="dod">Date of Death</label>
              <input
                id="dod"
                type="date"
                value={form.dateOfDeath || ""}
                onChange={(e) => updateField("dateOfDeath", e.target.value)}
              />
              <span className="field-hint">Leave empty if living</span>
            </div>

            <div className="field">
              <label htmlFor="city">City / Town</label>
              <input
                id="city"
                type="text"
                value={form.city || ""}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="Current or last known city"
              />
            </div>

            <div className="field">
              <label htmlFor="occupation">Occupation</label>
              <input
                id="occupation"
                type="text"
                value={form.occupation || ""}
                onChange={(e) => updateField("occupation", e.target.value)}
                placeholder="e.g., Teacher, Engineer, Farmer"
              />
            </div>

            <div className="field">
              <label htmlFor="education">Education</label>
              <input
                id="education"
                type="text"
                value={form.education || ""}
                onChange={(e) => updateField("education", e.target.value)}
                placeholder="Highest qualification"
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={form.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+91 98765 43210"
              />
              <span className="field-hint">
                Used as secondary identifier for linking records
              </span>
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={form.email || ""}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div className="field">
              <label htmlFor="linkedin">LinkedIn Profile</label>
              <input
                id="linkedin"
                type="url"
                value={form.linkedinUrl || ""}
                onChange={(e) => updateField("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <div className="field full-width">
              <label htmlFor="notes">Additional Notes</label>
              <textarea
                id="notes"
                value={form.additionalNotes || ""}
                onChange={(e) =>
                  updateField("additionalNotes", e.target.value)
                }
                placeholder="Any additional details, stories, achievements, nicknames..."
                rows={3}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Family Connections</legend>
          <p className="fieldset-hint">
            Search for existing family members to link. If they haven't
            registered yet, you can create a placeholder that they'll claim
            later.
          </p>

          <div className="form-grid">
            <PersonSearch
              label="Father"
              familyName={activeFamilyName}
              selectedPerson={father}
              onSelect={setFather}
              onCreateNew={(name) =>
                createPendingPerson(name, "FATHER_OF", setFather)
              }
              onClear={() => setFather(null)}
              placeholder="Search for father's name..."
            />

            <PersonSearch
              label="Mother"
              selectedPerson={mother}
              onSelect={setMother}
              onCreateNew={(name) =>
                createPendingPerson(name, "MOTHER_OF", setMother)
              }
              onClear={() => setMother(null)}
              placeholder="Search for mother's name..."
            />

            <PersonSearch
              label="Spouse"
              selectedPerson={spouse}
              onSelect={setSpouse}
              onCreateNew={(name) =>
                createPendingPerson(name, "SPOUSE_OF", setSpouse)
              }
              onClear={() => setSpouse(null)}
              placeholder="Search for spouse's name..."
            />

            <div className="field full-width">
              <label>Children</label>
              <div className="multi-person-list">
                {children.map((child) => (
                  <div key={child.id} className="selected-person">
                    <span className="selected-person-name">
                      {child.fullName}
                    </span>
                    {child.status === "pending" && (
                      <span className="badge badge-pending">Pending</span>
                    )}
                    <button
                      type="button"
                      className="btn-clear"
                      onClick={() =>
                        setChildren((prev) =>
                          prev.filter((c) => c.id !== child.id)
                        )
                      }
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <PersonSearch
                label=""
                familyName={activeFamilyName}
                onSelect={(p) =>
                  setChildren((prev) =>
                    prev.some((c) => c.id === p.id)
                      ? prev
                      : [...prev, p]
                  )
                }
                onCreateNew={(name) =>
                  createPendingPerson(name, "FATHER_OF", (p) =>
                    setChildren((prev) => [...prev, p])
                  )
                }
                placeholder="Search for child's name..."
              />
            </div>

            <div className="field full-width">
              <label>Siblings</label>
              <div className="multi-person-list">
                {siblings.map((sib) => (
                  <div key={sib.id} className="selected-person">
                    <span className="selected-person-name">
                      {sib.fullName}
                    </span>
                    {sib.status === "pending" && (
                      <span className="badge badge-pending">Pending</span>
                    )}
                    <button
                      type="button"
                      className="btn-clear"
                      onClick={() =>
                        setSiblings((prev) =>
                          prev.filter((s) => s.id !== sib.id)
                        )
                      }
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <PersonSearch
                label=""
                onSelect={(p) =>
                  setSiblings((prev) =>
                    prev.some((s) => s.id === p.id)
                      ? prev
                      : [...prev, p]
                  )
                }
                onCreateNew={(name) =>
                  createPendingPerson(name, "SIBLING_OF", (p) =>
                    setSiblings((prev) => [...prev, p])
                  )
                }
                placeholder="Search for sibling's name..."
              />
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !form.fullName || (!form.familyName && !customFamily)}
          >
            {submitting ? "Saving..." : "Add Family Member"}
          </button>
        </div>
      </form>
    </div>
  );
}
