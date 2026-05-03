"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FamilyBrowser } from "../../components/FamilyBrowser";

function BrowseInner() {
  const searchParams = useSearchParams();
  const personId = searchParams.get("person");

  // Local refreshKey so edits made inside FamilyBrowser force a re-fetch of
  // the family list (same pattern the original App.tsx used globally).
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <FamilyBrowser
      refreshKey={refreshKey}
      navigateToPersonId={personId ?? null}
      onDataChanged={() => setRefreshKey((k) => k + 1)}
    />
  );
}

// Next.js requires a Suspense boundary around components that use
// `useSearchParams()` so the route can be pre-rendered statically.
export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="graph-loading">Loading…</div>}>
      <BrowseInner />
    </Suspense>
  );
}
