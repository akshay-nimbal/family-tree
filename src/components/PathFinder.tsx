"use client";

import { useState } from "react";
import { api } from "../api/client";
import { PersonSearch } from "./PersonSearch";
import type { PersonRecord, RelationshipPath } from "../types";

const REL_LABELS: Record<string, string> = {
  FATHER_OF: "father of",
  MOTHER_OF: "mother of",
  SPOUSE_OF: "spouse of",
  SIBLING_OF: "sibling of",
};

/**
 * Find all relationship paths between two people.
 * Shows how Person A is related to Person B through multiple paths,
 * revealing the complex intermarried connections.
 */
export function PathFinder() {
  const [personA, setPersonA] = useState<PersonRecord | null>(null);
  const [personB, setPersonB] = useState<PersonRecord | null>(null);
  const [paths, setPaths] = useState<RelationshipPath[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function findPaths() {
    if (!personA || !personB) return;
    setLoading(true);
    setSearched(true);
    try {
      const result = await api.findPaths(personA.id, personB.id);
      setPaths(result);
    } catch {
      setPaths([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="path-finder">
      <h2>Find Relationships</h2>
      <p className="form-description">
        Discover how two people are connected through the family graph. This
        reveals all paths — uncle from one side, brother-in-law from another.
      </p>

      <div className="path-finder-inputs">
        <PersonSearch
          label="Person A"
          selectedPerson={personA}
          onSelect={setPersonA}
          onClear={() => {
            setPersonA(null);
            setPaths([]);
            setSearched(false);
          }}
        />
        <PersonSearch
          label="Person B"
          selectedPerson={personB}
          onSelect={setPersonB}
          onClear={() => {
            setPersonB(null);
            setPaths([]);
            setSearched(false);
          }}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={findPaths}
        disabled={!personA || !personB || loading}
      >
        {loading ? "Searching..." : "Find Connections"}
      </button>

      {searched && !loading && (
        <div className="path-results">
          {paths.length === 0 ? (
            <p className="empty-state">
              No connections found between these two people.
            </p>
          ) : (
            <>
              <h3>
                {paths.length} connection{paths.length !== 1 ? "s" : ""} found
              </h3>
              {paths.map((p, i) => (
                <div key={i} className="path-card">
                  <div className="path-chain">
                    {p.path.map((name, j) => (
                      <span key={j}>
                        <span className="path-person">{name}</span>
                        {j < p.relationships.length && (
                          <span className="path-rel">
                            {" "}
                            → {REL_LABELS[p.relationships[j]] || p.relationships[j]}{" "}
                            →{" "}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
