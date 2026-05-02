import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import type { PersonRecord, SearchResult } from "../types";

interface PersonSearchProps {
  label: string;
  familyName?: string;
  onSelect: (person: PersonRecord) => void;
  onCreateNew?: (name: string) => void;
  placeholder?: string;
  selectedPerson?: PersonRecord | null;
  onClear?: () => void;
}

/**
 * Autocomplete search with built-in duplicate prevention.
 *
 * When a user clicks "Create new pending record", we DON'T immediately create it.
 * Instead we run a global duplicate check (across ALL families) and show any
 * matches. The user must explicitly confirm "none of these are the person"
 * before a new record is created.
 */
export function PersonSearch({
  label,
  familyName,
  onSelect,
  onCreateNew,
  placeholder,
  selectedPerson,
  onClear,
}: PersonSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [dupCheckName, setDupCheckName] = useState<string | null>(null);
  const [dupResults, setDupResults] = useState<SearchResult[]>([]);
  const [dupLoading, setDupLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchPersons(query, familyName, 8);
        setResults(data);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, familyName]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCreateNewClick(name: string) {
    setIsOpen(false);
    setDupCheckName(name);
    setDupLoading(true);
    try {
      const matches = await api.checkDuplicates(name);
      setDupResults(matches);
    } catch {
      setDupResults([]);
    } finally {
      setDupLoading(false);
    }
  }

  function handleDupSelect(person: PersonRecord) {
    onSelect(person);
    setQuery("");
    setDupCheckName(null);
    setDupResults([]);
  }

  function handleConfirmCreate() {
    if (dupCheckName && onCreateNew) {
      onCreateNew(dupCheckName);
    }
    setQuery("");
    setDupCheckName(null);
    setDupResults([]);
  }

  function handleCancelDupCheck() {
    setDupCheckName(null);
    setDupResults([]);
  }

  if (selectedPerson) {
    return (
      <div className="field">
        <label>{label}</label>
        <div className="selected-person">
          <span className="selected-person-name">
            {selectedPerson.fullName}
          </span>
          {selectedPerson.status === "pending" && (
            <span className="badge badge-pending">Pending</span>
          )}
          {onClear && (
            <button
              type="button"
              className="btn-clear"
              onClick={onClear}
              aria-label={`Remove ${selectedPerson.fullName}`}
            >
              &times;
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="field person-search" ref={containerRef}>
      <label>{label}</label>

      {dupCheckName ? (
        <div className="dup-check-panel">
          <div className="dup-check-header">
            <strong>Before creating &ldquo;{dupCheckName}&rdquo;</strong>
            <p>
              We found these existing records across all families. Is any of
              these the same person?
            </p>
          </div>

          {dupLoading ? (
            <p className="dup-check-loading">Checking for duplicates...</p>
          ) : dupResults.length > 0 ? (
            <div className="dup-check-results">
              {dupResults.map((r) => (
                <button
                  key={r.person.id}
                  type="button"
                  className="search-result"
                  onClick={() => handleDupSelect(r.person)}
                >
                  <div className="search-result-name">
                    {r.person.fullName}
                    {r.person.status === "pending" && (
                      <span className="badge badge-pending">Pending</span>
                    )}
                  </div>
                  <div className="search-result-details">
                    {[
                      r.person.familyName && `Family: ${r.person.familyName}`,
                      r.person.city,
                      r.person.dateOfBirth,
                      r.person.phone,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="search-result-score">{r.matchReason}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="dup-check-none">
              No existing records found matching this name.
            </p>
          )}

          <div className="dup-check-actions">
            {onCreateNew && (
              <button
                type="button"
                className="btn btn-dup-confirm"
                onClick={handleConfirmCreate}
              >
                {dupResults.length > 0
                  ? "None of these — Create new record"
                  : "Create new pending record"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelDupCheck}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="search-input-wrapper">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder || "Search by name, phone, or email..."}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              autoComplete="off"
            />
            {loading && <span className="search-spinner" />}
          </div>

          {isOpen && (
            <div className="search-dropdown">
              {results.length > 0 ? (
                results.map((r) => (
                  <button
                    key={r.person.id}
                    type="button"
                    className="search-result"
                    onClick={() => {
                      onSelect(r.person);
                      setQuery("");
                      setIsOpen(false);
                    }}
                  >
                    <div className="search-result-name">
                      {r.person.fullName}
                      {r.person.status === "pending" && (
                        <span className="badge badge-pending">Pending</span>
                      )}
                    </div>
                    <div className="search-result-details">
                      {[
                        r.person.familyName,
                        r.person.city,
                        r.person.dateOfBirth,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="search-result-score">{r.matchReason}</div>
                  </button>
                ))
              ) : (
                query.length >= 2 && (
                  <div className="search-no-results">
                    No existing records found for &ldquo;{query}&rdquo;
                  </div>
                )
              )}

              {onCreateNew && query.length >= 2 && (
                <button
                  type="button"
                  className="search-create-new"
                  onClick={() => handleCreateNewClick(query)}
                >
                  + Create new pending record for &ldquo;{query}&rdquo;
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
