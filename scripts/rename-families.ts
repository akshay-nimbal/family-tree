/**
 * One-off data migration: rename surnames (both the `Family` node and every
 * `Person.familyName` that references it).
 *
 * Run against whatever NEO4J_URI / NEO4J_DATABASE your .env.local points at:
 *   npx tsx --env-file=.env.local scripts/rename-families.ts
 */
import neo4j from "neo4j-driver";

const URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const USER = process.env.NEO4J_USER || "neo4j";
const PASSWORD = process.env.NEO4J_PASSWORD || "vamsha_dev_password";
const DATABASE = process.env.NEO4J_DATABASE;

const RENAMES: Array<{ from: string; to: string }> = [
  { from: "Deshpande", to: "Chadchan" },
  { from: "Joshi", to: "Nalwar" },
  { from: "Kulkarni", to: "Khed" },
];

async function main(): Promise<void> {
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
    maxConnectionPoolSize: 5,
    connectionAcquisitionTimeout: 15000,
  });
  const session = DATABASE
    ? driver.session({ database: DATABASE })
    : driver.session();
  const now = new Date().toISOString();

  try {
    for (const { from, to } of RENAMES) {
      // Safety: if the target name already exists we can't rename — the
      // Family.name uniqueness constraint would reject it, and silently
      // merging nodes would be a lot more destructive than a user expects
      // from a rename. Bail out loudly instead.
      const existing = await session.run(
        "MATCH (f:Family {name: $name}) RETURN count(f) AS c",
        { name: to }
      );
      const existingCount = existing.records[0].get("c").toNumber();
      if (existingCount > 0) {
        console.warn(
          `[skip] ${from} -> ${to}: a Family named "${to}" already exists. ` +
            `Delete/merge it first if you really want to proceed.`
        );
        continue;
      }

      // 1) rename the Family node itself
      const familyResult = await session.run(
        "MATCH (f:Family {name: $from}) SET f.name = $to RETURN count(f) AS c",
        { from, to }
      );
      const renamedFamilies = familyResult.records[0].get("c").toNumber();

      // 2) rewrite every Person.familyName that used the old label
      const personResult = await session.run(
        `MATCH (p:Person {familyName: $from})
         SET p.familyName = $to, p.updatedAt = $now
         RETURN count(p) AS c`,
        { from, to, now }
      );
      const renamedPersons = personResult.records[0].get("c").toNumber();

      console.log(
        `${from} -> ${to}: ${renamedFamilies} Family node, ${renamedPersons} Person nodes updated`
      );
    }

    console.log("\nDone.");
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
