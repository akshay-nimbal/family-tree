"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../api/client";
import { PersonForm } from "../../components/PersonForm";

export default function AddPage() {
  const router = useRouter();
  const [familyNames, setFamilyNames] = useState<string[]>([]);

  const loadFamilies = useCallback(async () => {
    try {
      const families = await api.getFamilies();
      setFamilyNames(families.map((f) => f.name));
    } catch {
      /* backend may not be up yet */
    }
  }, []);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  return (
    <PersonForm
      families={familyNames}
      onPersonCreated={() => {
        // After adding someone, refresh the families list so new family names
        // appear, then hop to browse so the user can see the new record.
        loadFamilies();
        router.push("/browse");
      }}
    />
  );
}
