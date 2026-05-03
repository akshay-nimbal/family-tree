import { useState, useEffect } from "react";
import { api } from "../api/client";
import { PersonSearch } from "./PersonSearch";
import { PhotoUpload, PhotoAvatar } from "./PhotoUpload";
import type {
  FamilyRecord,
  PersonInput,
  PersonRecord,
  PersonRelationships,
  RelationshipType,
} from "../types";

interface FamilyBrowserProps {
  refreshKey: number;
  onDataChanged?: () => void;
  navigateToPersonId?: string | null;
}

export function FamilyBrowser({ refreshKey, onDataChanged, navigateToPersonId }: FamilyBrowserProps) {
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [members, setMembers] = useState<PersonRecord[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);
  const [relationships, setRelationships] = useState<PersonRelationships | null>(null);
  const [loading, setLoading] = useState(false);

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<PersonRecord | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PersonInput>>({});
  const [saving, setSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api.getFamilies().then(setFamilies).catch(console.error);
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedFamily) {
      setMembers([]);
      return;
    }
    setLoading(true);
    api
      .getFamilyMembers(selectedFamily)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedFamily, refreshKey]);

  useEffect(() => {
    if (!navigateToPersonId) return;
    api
      .getPerson(navigateToPersonId)
      .then((person) => {
        setSelectedFamily(person.familyName);
        viewPerson(person);
      })
      .catch(console.error);
  }, [navigateToPersonId]);

  async function viewPerson(person: PersonRecord) {
    setSelectedPerson(person);
    setEditing(false);
    setEditMessage(null);
    setMergeMode(false);
    setMergeTarget(null);
    setMergeMessage(null);
    try {
      const rels = await api.getRelationships(person.id);
      setRelationships(rels);
    } catch {
      setRelationships(null);
    }
  }

  interface RelEdit {
    father: PersonRecord | null;
    mother: PersonRecord | null;
    spouses: PersonRecord[];
    children: PersonRecord[];
    siblings: PersonRecord[];
  }

  const [editRels, setEditRels] = useState<RelEdit>({
    father: null, mother: null, spouses: [], children: [], siblings: [],
  });
  const [origRels, setOrigRels] = useState<RelEdit>({
    father: null, mother: null, spouses: [], children: [], siblings: [],
  });

  function startEditing() {
    if (!selectedPerson || !relationships) return;
    setEditForm({
      fullName: selectedPerson.fullName,
      dateOfBirth: selectedPerson.dateOfBirth || "",
      dateOfDeath: selectedPerson.dateOfDeath || "",
      gender: selectedPerson.gender || undefined,
      city: selectedPerson.city || "",
      occupation: selectedPerson.occupation || "",
      education: selectedPerson.education || "",
      phone: selectedPerson.phone || "",
      email: selectedPerson.email || "",
      linkedinUrl: selectedPerson.linkedinUrl || "",
      additionalNotes: selectedPerson.additionalNotes || "",
    });
    const snapshot: RelEdit = {
      father: relationships.father,
      mother: relationships.mother,
      spouses: [...relationships.spouses],
      children: [...relationships.children],
      siblings: [...relationships.siblings],
    };
    setEditRels({ ...snapshot, spouses: [...snapshot.spouses], children: [...snapshot.children], siblings: [...snapshot.siblings] });
    setOrigRels(snapshot);
    setEditing(true);
    setEditMessage(null);
  }

  function cancelEditing() {
    setEditing(false);
    setEditForm({});
    setEditMessage(null);
  }

  async function saveEdits() {
    if (!selectedPerson) return;
    setSaving(true);
    setEditMessage(null);
    try {
      const updates: Partial<PersonInput> = {};
      const fields: Array<keyof PersonInput> = [
        "fullName", "dateOfBirth", "dateOfDeath", "gender",
        "city", "occupation", "education", "phone", "email",
        "linkedinUrl", "additionalNotes",
      ];
      for (const field of fields) {
        const newVal = (editForm as Record<string, string | undefined>)[field] || undefined;
        const oldVal = (selectedPerson as Record<string, string | undefined>)[field] || undefined;
        if (newVal !== oldVal) {
          (updates as Record<string, string | undefined>)[field] = newVal || "";
        }
      }

      if (selectedPerson.status === "pending") {
        const hasEnoughDetail = !!(
          (editForm.fullName?.trim()) &&
          (editForm.phone?.trim() || editForm.email?.trim() || editForm.dateOfBirth?.trim())
        );
        if (hasEnoughDetail) {
          updates.status = "verified";
        }
      }

      if (Object.keys(updates).length > 0) {
        const updated = await api.updatePerson(selectedPerson.id, updates);
        setSelectedPerson(updated);
      }

      await saveRelationshipEdits();

      setEditing(false);
      const rels = await api.getRelationships(selectedPerson.id);
      setRelationships(rels);
      setEditMessage({ type: "success", text: "Changes saved successfully." });
      onDataChanged?.();
    } catch (err) {
      setEditMessage({
        type: "error",
        text: `Save failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveRelationshipEdits() {
    if (!selectedPerson) return;
    const pid = selectedPerson.id;

    if (origRels.father?.id !== editRels.father?.id) {
      if (origRels.father) {
        await api.removeRelationship({ fromPersonId: origRels.father.id, toPersonId: pid, type: "FATHER_OF" });
      }
      if (editRels.father) {
        await api.createRelationship({ fromPersonId: editRels.father.id, toPersonId: pid, type: "FATHER_OF" });
      }
    }

    if (origRels.mother?.id !== editRels.mother?.id) {
      if (origRels.mother) {
        await api.removeRelationship({ fromPersonId: origRels.mother.id, toPersonId: pid, type: "MOTHER_OF" });
      }
      if (editRels.mother) {
        await api.createRelationship({ fromPersonId: editRels.mother.id, toPersonId: pid, type: "MOTHER_OF" });
      }
    }

    const origSpouseIds = new Set(origRels.spouses.map((s) => s.id));
    const newSpouseIds = new Set(editRels.spouses.map((s) => s.id));
    for (const s of origRels.spouses) {
      if (!newSpouseIds.has(s.id)) {
        await api.removeRelationship({ fromPersonId: pid, toPersonId: s.id, type: "SPOUSE_OF" });
      }
    }
    for (const s of editRels.spouses) {
      if (!origSpouseIds.has(s.id)) {
        await api.createRelationship({ fromPersonId: pid, toPersonId: s.id, type: "SPOUSE_OF" });
      }
    }

    const origChildIds = new Set(origRels.children.map((c) => c.id));
    const newChildIds = new Set(editRels.children.map((c) => c.id));
    const parentRel: RelationshipType = selectedPerson.gender === "female" ? "MOTHER_OF" : "FATHER_OF";
    for (const c of origRels.children) {
      if (!newChildIds.has(c.id)) {
        await api.removeRelationship({ fromPersonId: pid, toPersonId: c.id, type: parentRel });
      }
    }
    for (const c of editRels.children) {
      if (!origChildIds.has(c.id)) {
        await api.createRelationship({ fromPersonId: pid, toPersonId: c.id, type: parentRel });
      }
    }

    const origSibIds = new Set(origRels.siblings.map((s) => s.id));
    const newSibIds = new Set(editRels.siblings.map((s) => s.id));
    for (const s of origRels.siblings) {
      if (!newSibIds.has(s.id)) {
        await api.removeRelationship({ fromPersonId: pid, toPersonId: s.id, type: "SIBLING_OF" });
      }
    }
    for (const s of editRels.siblings) {
      if (!origSibIds.has(s.id)) {
        await api.createRelationship({ fromPersonId: pid, toPersonId: s.id, type: "SIBLING_OF" });
      }
    }
  }

  function updateEditField(field: string, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleMerge() {
    if (!selectedPerson || !mergeTarget) return;
    const keepPerson = selectedPerson.status === "verified" ? selectedPerson : mergeTarget;
    const removePerson = selectedPerson.status === "verified" ? mergeTarget : selectedPerson;

    setMerging(true);
    setMergeMessage(null);
    try {
      const merged = await api.mergePersons(keepPerson.id, removePerson.id);
      setMergeMessage(
        `Merged successfully! "${removePerson.fullName}" (${removePerson.status}) has been merged into "${merged.fullName}" (${merged.status}). All relationships transferred.`
      );
      setMergeMode(false);
      setMergeTarget(null);
      setSelectedPerson(merged);
      const rels = await api.getRelationships(merged.id);
      setRelationships(rels);
      onDataChanged?.();
    } catch (err) {
      setMergeMessage(
        `Merge failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setMerging(false);
    }
  }

  async function jumpToPerson(person: PersonRecord) {
    setSelectedFamily(person.familyName);
    await viewPerson(person);
  }

  function closeDetail() {
    if (editing || mergeMode) return;
    setSelectedPerson(null);
    setRelationships(null);
    setEditMessage(null);
    setMergeMessage(null);
  }

  useEffect(() => {
    if (!selectedPerson) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDetail();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPerson, editing, mergeMode]);

  return (
    <div className="family-browser">
      <h2>Browse Families</h2>

      <div className="browse-quick-search">
        <PersonSearch
          label="Jump to a person"
          onSelect={jumpToPerson}
          placeholder="Type a name, phone, or email to find anyone…"
        />
      </div>

      <div className="family-grid">
        {families.length === 0 ? (
          <p className="empty-state">
            No families yet. Add a family member to get started.
          </p>
        ) : (
          families.map((fam) => (
            <button
              key={fam.id}
              className={`family-card ${selectedFamily === fam.name ? "active" : ""}`}
              onClick={() => {
                setSelectedFamily(selectedFamily === fam.name ? null : fam.name);
                setSelectedPerson(null);
                setRelationships(null);
                setEditing(false);
                setMergeMode(false);
                setMergeMessage(null);
              }}
            >
              <div className="family-card-name">{fam.name}</div>
              <div className="family-card-count">
                {fam.memberCount} member{fam.memberCount !== 1 ? "s" : ""}
              </div>
            </button>
          ))
        )}
      </div>

      {selectedFamily && (
        <div className="members-section">
          <h3>{selectedFamily} Family Members</h3>
          {loading ? (
            <p>Loading...</p>
          ) : members.length === 0 ? (
            <p className="empty-state">No members found.</p>
          ) : (
            <div className="members-grid">
              {members.map((member) => (
                <button
                  key={member.id}
                  className={`member-card ${selectedPerson?.id === member.id ? "active" : ""}`}
                  onClick={() => viewPerson(member)}
                >
                  <div className="member-card-name">
                    {member.fullName}
                    {member.status === "pending" && (
                      <span className="badge badge-pending">Pending</span>
                    )}
                  </div>
                  <div className="member-card-details">
                    {[member.city, member.occupation].filter(Boolean).join(" · ") ||
                      "No details yet"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPerson && (
        <div
          className="person-modal-backdrop"
          onClick={closeDetail}
          role="presentation"
        >
          <div
            className="person-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Details for ${selectedPerson.fullName}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="person-modal-close"
              onClick={closeDetail}
              aria-label="Close details"
              title={editing || mergeMode ? "Finish or cancel edits first" : "Close (Esc)"}
              disabled={editing || mergeMode}
            >
              &times;
            </button>
            <div className="person-detail person-detail--in-modal">
          <div className="person-detail-header">
            <PhotoAvatar
              photoUrl={selectedPerson.photoUrl}
              name={selectedPerson.fullName}
              size={56}
            />
            <div className="person-detail-header-info">
              <h3>{selectedPerson.fullName}</h3>
              {selectedPerson.status === "pending" && (
                <span className="badge badge-pending badge-lg">
                  Pending — Not yet claimed
                </span>
              )}
            </div>
            {!editing && (
              <button className="btn btn-edit" onClick={startEditing}>
                Edit
              </button>
            )}
          </div>

          {editMessage && (
            <div className={`alert ${editMessage.type === "error" ? "alert-error" : "alert-success"}`}>
              {editMessage.text}
              <button type="button" className="btn-clear" onClick={() => setEditMessage(null)}>
                &times;
              </button>
            </div>
          )}

          {mergeMessage && (
            <div className={`alert ${mergeMessage.startsWith("Merge failed") ? "alert-error" : "alert-success"}`}>
              {mergeMessage}
              <button type="button" className="btn-clear" onClick={() => setMergeMessage(null)}>
                &times;
              </button>
            </div>
          )}

          {editing ? (
            <div className="edit-form">
              <PhotoUpload
                personId={selectedPerson.id}
                currentPhotoUrl={selectedPerson.photoUrl}
                onPhotoUploaded={(url) => setSelectedPerson({ ...selectedPerson, photoUrl: url })}
              />
              <div className="form-grid">
                <EditField
                  label="Full Name"
                  value={editForm.fullName || ""}
                  onChange={(v) => updateEditField("fullName", v)}
                  required
                />
                <div className="field">
                  <label>Gender</label>
                  <select
                    value={editForm.gender || ""}
                    onChange={(e) => updateEditField("gender", e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <EditField
                  label="Date of Birth"
                  value={editForm.dateOfBirth || ""}
                  onChange={(v) => updateEditField("dateOfBirth", v)}
                  type="date"
                />
                <EditField
                  label="Date of Death"
                  value={editForm.dateOfDeath || ""}
                  onChange={(v) => updateEditField("dateOfDeath", v)}
                  type="date"
                />
                <EditField
                  label="City / Town"
                  value={editForm.city || ""}
                  onChange={(v) => updateEditField("city", v)}
                />
                <EditField
                  label="Occupation"
                  value={editForm.occupation || ""}
                  onChange={(v) => updateEditField("occupation", v)}
                />
                <EditField
                  label="Education"
                  value={editForm.education || ""}
                  onChange={(v) => updateEditField("education", v)}
                />
                <EditField
                  label="Phone"
                  value={editForm.phone || ""}
                  onChange={(v) => updateEditField("phone", v)}
                  type="tel"
                />
                <EditField
                  label="Email"
                  value={editForm.email || ""}
                  onChange={(v) => updateEditField("email", v)}
                  type="email"
                />
                <EditField
                  label="LinkedIn"
                  value={editForm.linkedinUrl || ""}
                  onChange={(v) => updateEditField("linkedinUrl", v)}
                  type="url"
                />
                <div className="field full-width">
                  <label>Additional Notes</label>
                  <textarea
                    value={editForm.additionalNotes || ""}
                    onChange={(e) => updateEditField("additionalNotes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="edit-relationships">
                <h4>Family Connections</h4>

                <PersonSearch
                  label="Father"
                  selectedPerson={editRels.father}
                  onSelect={(p) => setEditRels((prev) => ({ ...prev, father: p }))}
                  onCreateNew={async (name) => {
                    const pending = await api.createPerson({ fullName: name, familyName: selectedPerson.familyName, status: "pending" });
                    setEditRels((prev) => ({ ...prev, father: pending }));
                  }}
                  onClear={() => setEditRels((prev) => ({ ...prev, father: null }))}
                  placeholder="Search for father..."
                />

                <PersonSearch
                  label="Mother"
                  selectedPerson={editRels.mother}
                  onSelect={(p) => setEditRels((prev) => ({ ...prev, mother: p }))}
                  onCreateNew={async (name) => {
                    const pending = await api.createPerson({ fullName: name, familyName: selectedPerson.familyName, status: "pending" });
                    setEditRels((prev) => ({ ...prev, mother: pending }));
                  }}
                  onClear={() => setEditRels((prev) => ({ ...prev, mother: null }))}
                  placeholder="Search for mother..."
                />

                <div className="field full-width">
                  <label>Spouse(s)</label>
                  <div className="multi-person-list">
                    {editRels.spouses.map((s) => (
                      <div key={s.id} className="selected-person">
                        <span className="selected-person-name">{s.fullName}</span>
                        {s.status === "pending" && <span className="badge badge-pending">Pending</span>}
                        <button
                          type="button"
                          className="btn-clear"
                          onClick={() => setEditRels((prev) => ({ ...prev, spouses: prev.spouses.filter((x) => x.id !== s.id) }))}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                  <PersonSearch
                    label=""
                    onSelect={(p) =>
                      setEditRels((prev) => ({
                        ...prev,
                        spouses: prev.spouses.some((x) => x.id === p.id) ? prev.spouses : [...prev.spouses, p],
                      }))
                    }
                    onCreateNew={async (name) => {
                      const pending = await api.createPerson({ fullName: name, familyName: selectedPerson.familyName, status: "pending" });
                      setEditRels((prev) => ({ ...prev, spouses: [...prev.spouses, pending] }));
                    }}
                    placeholder="Search for spouse..."
                  />
                </div>

                <div className="field full-width">
                  <label>Children</label>
                  <div className="multi-person-list">
                    {editRels.children.map((c) => (
                      <div key={c.id} className="selected-person">
                        <span className="selected-person-name">{c.fullName}</span>
                        {c.status === "pending" && <span className="badge badge-pending">Pending</span>}
                        <button
                          type="button"
                          className="btn-clear"
                          onClick={() => setEditRels((prev) => ({ ...prev, children: prev.children.filter((x) => x.id !== c.id) }))}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                  <PersonSearch
                    label=""
                    onSelect={(p) =>
                      setEditRels((prev) => ({
                        ...prev,
                        children: prev.children.some((x) => x.id === p.id) ? prev.children : [...prev.children, p],
                      }))
                    }
                    onCreateNew={async (name) => {
                      const pending = await api.createPerson({ fullName: name, familyName: selectedPerson.familyName, status: "pending" });
                      setEditRels((prev) => ({ ...prev, children: [...prev.children, pending] }));
                    }}
                    placeholder="Search for child..."
                  />
                </div>

                <div className="field full-width">
                  <label>Siblings</label>
                  <div className="multi-person-list">
                    {editRels.siblings.map((s) => (
                      <div key={s.id} className="selected-person">
                        <span className="selected-person-name">{s.fullName}</span>
                        {s.status === "pending" && <span className="badge badge-pending">Pending</span>}
                        <button
                          type="button"
                          className="btn-clear"
                          onClick={() => setEditRels((prev) => ({ ...prev, siblings: prev.siblings.filter((x) => x.id !== s.id) }))}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                  <PersonSearch
                    label=""
                    onSelect={(p) =>
                      setEditRels((prev) => ({
                        ...prev,
                        siblings: prev.siblings.some((x) => x.id === p.id) ? prev.siblings : [...prev.siblings, p],
                      }))
                    }
                    onCreateNew={async (name) => {
                      const pending = await api.createPerson({ fullName: name, familyName: selectedPerson.familyName, status: "pending" });
                      setEditRels((prev) => ({ ...prev, siblings: [...prev.siblings, pending] }));
                    }}
                    placeholder="Search for sibling..."
                  />
                </div>
              </div>

              <div className="edit-actions">
                <button
                  className="btn btn-primary"
                  onClick={saveEdits}
                  disabled={saving || !editForm.fullName?.trim()}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-grid">
              <DetailRow label="Family" value={selectedPerson.familyName} />
              <DetailRow label="Gender" value={selectedPerson.gender} />
              <DetailRow label="Date of Birth" value={selectedPerson.dateOfBirth} />
              <DetailRow label="Date of Death" value={selectedPerson.dateOfDeath} />
              <DetailRow label="City" value={selectedPerson.city} />
              <DetailRow label="Occupation" value={selectedPerson.occupation} />
              <DetailRow label="Education" value={selectedPerson.education} />
              <DetailRow label="Phone" value={selectedPerson.phone} />
              <DetailRow label="Email" value={selectedPerson.email} />
              <DetailRow label="LinkedIn" value={selectedPerson.linkedinUrl} isLink />
              <DetailRow label="Status" value={selectedPerson.status} />
              <DetailRow label="Notes" value={selectedPerson.additionalNotes} />
              <DetailRow label="ID" value={selectedPerson.id} />
            </div>
          )}

          {!editing && relationships && (
            <div className="relationships-section">
              <h4>Family Connections</h4>
              <RelRow label="Father" persons={relationships.father ? [relationships.father] : []} onSelect={viewPerson} />
              <RelRow label="Mother" persons={relationships.mother ? [relationships.mother] : []} onSelect={viewPerson} />
              <RelRow label="Spouse(s)" persons={relationships.spouses} onSelect={viewPerson} />
              <RelRow label="Children" persons={relationships.children} onSelect={viewPerson} />
              <RelRow label="Siblings" persons={relationships.siblings} onSelect={viewPerson} />
            </div>
          )}

          {!editing && (
            <div className="merge-section">
              <h4>Merge Duplicate Records</h4>
              <p className="merge-description">
                If this person has a duplicate record (e.g., a pending placeholder
                created by someone else), you can merge them. All relationships
                from the duplicate will be transferred to the kept record.
              </p>

              {!mergeMode ? (
                <button className="btn btn-merge" onClick={() => setMergeMode(true)}>
                  Find &amp; Merge Duplicate
                </button>
              ) : (
                <div className="merge-flow">
                  <PersonSearch
                    label="Search for the duplicate record to merge INTO this one"
                    onSelect={setMergeTarget}
                    selectedPerson={mergeTarget}
                    onClear={() => setMergeTarget(null)}
                    placeholder="Search by name, phone, or email..."
                  />

                  {mergeTarget && (
                    <div className="merge-preview">
                      <div className="merge-preview-card">
                        <div className="merge-preview-label">KEEP (this record)</div>
                        <div className="merge-preview-name">
                          {selectedPerson.status === "verified" ? selectedPerson.fullName : mergeTarget.fullName}
                        </div>
                        <div className="merge-preview-detail">
                          Status: {selectedPerson.status === "verified" ? selectedPerson.status : mergeTarget.status}
                          {" · "}
                          Family: {selectedPerson.status === "verified" ? selectedPerson.familyName : mergeTarget.familyName}
                        </div>
                      </div>
                      <div className="merge-arrow">→ absorbs →</div>
                      <div className="merge-preview-card merge-preview-remove">
                        <div className="merge-preview-label">REMOVE (will be deleted)</div>
                        <div className="merge-preview-name">
                          {selectedPerson.status === "verified" ? mergeTarget.fullName : selectedPerson.fullName}
                        </div>
                        <div className="merge-preview-detail">
                          Status: {selectedPerson.status === "verified" ? mergeTarget.status : selectedPerson.status}
                          {" · "}
                          Family: {selectedPerson.status === "verified" ? mergeTarget.familyName : selectedPerson.familyName}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="merge-actions">
                    {mergeTarget && (
                      <button className="btn btn-danger" onClick={handleMerge} disabled={merging}>
                        {merging ? "Merging..." : "Confirm Merge (cannot be undone)"}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setMergeMode(false); setMergeTarget(null); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}{required && " *"}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  isLink,
}: {
  label: string;
  value?: string;
  isLink?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="detail-value">
          {value}
        </a>
      ) : (
        <span className="detail-value">{value}</span>
      )}
    </div>
  );
}

function RelRow({
  label,
  persons,
  onSelect,
}: {
  label: string;
  persons: PersonRecord[];
  onSelect: (p: PersonRecord) => void;
}) {
  if (persons.length === 0) return null;
  return (
    <div className="rel-row">
      <span className="rel-label">{label}:</span>
      <div className="rel-persons">
        {persons.map((p) => (
          <button key={p.id} className="rel-person-link" onClick={() => onSelect(p)}>
            {p.fullName}
            {p.status === "pending" && <span className="badge badge-pending">Pending</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
