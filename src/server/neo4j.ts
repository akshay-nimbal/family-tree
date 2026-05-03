import neo4j, { Driver, Session } from "neo4j-driver";

// ---------------------------------------------------------------------------
// Driver singleton
//
// Next.js' dev server re-imports this module on every HMR cycle. If we created
// a fresh driver on each import we'd leak connection pools until the process
// restarted. Hanging the driver off `globalThis` keeps it alive across reloads.
// ---------------------------------------------------------------------------
const DRIVER_KEY = Symbol.for("vamsha.neo4j.driver");
const SCHEMA_KEY = Symbol.for("vamsha.neo4j.schemaPromise");

interface GlobalWithNeo4j {
  [DRIVER_KEY]?: Driver;
  [SCHEMA_KEY]?: Promise<void>;
}

const g = globalThis as unknown as GlobalWithNeo4j;

export function getDriver(): Driver {
  if (!g[DRIVER_KEY]) {
    const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD;
    if (!password) {
      // Do NOT silently fall back to a hard-coded password in production.
      // The dev default lives in .env.local only so credentials never ship
      // in source. If it's missing, fail loudly.
      throw new Error(
        "NEO4J_PASSWORD is not set. Copy .env.example to .env.local and fill it in."
      );
    }
    g[DRIVER_KEY] = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30000,
    });
  }
  return g[DRIVER_KEY]!;
}

export function getSession(): Session {
  return getDriver().session();
}

// ---------------------------------------------------------------------------
// Schema init
//
// Express ran initSchema() once at startup. Next.js has no equivalent boot
// hook, so we memoise the schema promise and every API handler `await`s it.
// The first request pays the ~50ms constraint/index creation cost; every
// subsequent request short-circuits.
// ---------------------------------------------------------------------------
export function ensureSchema(): Promise<void> {
  if (!g[SCHEMA_KEY]) {
    g[SCHEMA_KEY] = initSchemaInternal().catch((err) => {
      // If initialisation failed let a later request try again.
      delete g[SCHEMA_KEY];
      throw err;
    });
  }
  return g[SCHEMA_KEY]!;
}

async function initSchemaInternal(): Promise<void> {
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
    console.log("[vamsha] Neo4j schema ensured.");
  } finally {
    await session.close();
  }
}
