"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FamilyBrowser } from "../components/FamilyBrowser";

function BrowseLanding() {
  const searchParams = useSearchParams();
  const personId = searchParams.get("person");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <FamilyBrowser
      refreshKey={refreshKey}
      navigateToPersonId={personId ?? null}
      onDataChanged={() => setRefreshKey((k) => k + 1)}
    />
  );
}

// Root route = Browse. `/browse` still renders the same page for backward
// compatibility with any existing deep links (see src/app/browse/page.tsx).
export default function Page() {
  return (
    <Suspense fallback={<div className="graph-loading">Loading…</div>}>
      <BrowseLanding />
    </Suspense>
  );
}
