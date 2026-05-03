"use client";

import { useRouter } from "next/navigation";
import { FamilyGraph } from "../components/FamilyGraph";

// Root route = Family Graph (matches the original App.tsx default tab).
export default function Page() {
  const router = useRouter();

  return (
    <FamilyGraph
      refreshKey={0}
      onViewPerson={(personId) => {
        router.push(`/browse?person=${encodeURIComponent(personId)}`);
      }}
    />
  );
}
