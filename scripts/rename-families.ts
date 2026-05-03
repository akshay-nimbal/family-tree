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
      // Figure out which families already exist so we can handle re-runs
      // (pass 1 may have completed previously; we still need to patch
      // Person.fullName strings that weren't touched then). Queries must run
      // sequentially — a single Neo4j session can only have one tx at a time.
      const fromExistsRes = await session.run(
        "MATCH (f:Family {name: $name}) RETURN count(f) AS c",
        { name: from }
      );
      const fromExists = fromExistsRes.records[0].get("c").toNumber() > 0;
      const toExistsRes = await session.run(
        "MATCH (f:Family {name: $name}) RETURN count(f) AS c",
        { name: to }
      );
      const toExists = toExistsRes.records[0].get("c").toNumber() > 0;

      let renamedFamilies = 0;
      let renamedPersons = 0;

      if (fromExists && toExists) {
        // Both exist — refuse to merge silently, that's destructive and not
        // what a rename implies.
        console.warn(
          `[skip family rename] ${from} & ${to} both exist as separate Family ` +
            `nodes. Merge them manually before re-running.`
        );
      } else if (fromExists && !toExists) {
        // 1) rename the Family node itself
        const familyResult = await session.run(
          "MATCH (f:Family {name: $from}) SET f.name = $to RETURN count(f) AS c",
          { from, to }
        );
        renamedFamilies = familyResult.records[0].get("c").toNumber();

        // 2) rewrite every Person.familyName that used the old label
        const personResult = await session.run(
          `MATCH (p:Person {familyName: $from})
           SET p.familyName = $to, p.updatedAt = $now
           RETURN count(p) AS c`,
          { from, to, now }
        );
        renamedPersons = personResult.records[0].get("c").toNumber();
      }
      // else: neither exists — nothing to rename at the Family level.

      // 3) Rewrite the surname inside every Person.fullName (and refresh the
      //    `normalizedName` lookup index that personService.ts maintains).
      //    Scope the match to people whose familyName is already $to so we
      //    don't touch unrelated records that happen to contain the string.
      //    `replace()` is safe here because surnames like
      //    "Deshpande"/"Joshi"/"Kulkarni" don't appear as substrings of
      //    plausible first names. This pass is idempotent — re-runs find no
      //    matches once every fullName is clean.
      const fullNameResult = await session.run(
        `MATCH (p:Person {familyName: $to})
         WHERE p.fullName CONTAINS $from
         WITH p, replace(p.fullName, $from, $to) AS newName
         SET p.fullName = newName,
             p.normalizedName = toLower(newName),
             p.updatedAt = $now
         RETURN count(p) AS c`,
        { from, to, now }
      );
      const renamedFullNames = fullNameResult.records[0].get("c").toNumber();

      console.log(
        `${from} -> ${to}: ${renamedFamilies} Family node, ` +
          `${renamedPersons} familyName refs, ` +
          `${renamedFullNames} fullName strings updated`
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
