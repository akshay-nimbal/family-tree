import { getDriver } from "./database";

/**
 * Initialize Neo4j constraints and indexes for the family tree graph.
 *
 * Data model:
 *   (:Person) - Core node. Every human in the tree.
 *   (:Family) - A family surname group (e.g., "Sharma", "Reddy").
 *
 * Relationship types stored as graph edges:
 *   FATHER_OF, MOTHER_OF, SPOUSE_OF, SIBLING_OF, BELONGS_TO_FAMILY
 *
 * Why graph over relational:
 *   "Find all relationship paths between Person A and Person B" is a single
 *   variable-length Cypher traversal. In SQL this requires recursive CTEs
 *   with exponential complexity for intermarried families.
 */
export async function initSchema(): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT family_id IF NOT EXISTS FOR (f:Family) REQUIRE f.id IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT family_name IF NOT EXISTS FOR (f:Family) REQUIRE f.name IS UNIQUE"
    );

    await session.run(
      "CREATE INDEX person_phone IF NOT EXISTS FOR (p:Person) ON (p.phone)"
    );
    await session.run(
      "CREATE INDEX person_email IF NOT EXISTS FOR (p:Person) ON (p.email)"
    );
    await session.run(
      "CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.fullName)"
    );
    await session.run(
      "CREATE INDEX person_status IF NOT EXISTS FOR (p:Person) ON (p.status)"
    );

    console.log("Neo4j schema constraints and indexes initialized.");
  } finally {
    await session.close();
  }
}
