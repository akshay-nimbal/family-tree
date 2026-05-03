"use client";

import { useRouter } from "next/navigation";
import { FamilyGraph } from "../../components/FamilyGraph";

// Family Graph now lives at /graph — the root route shows Browse instead.
export default function GraphPage() {
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
