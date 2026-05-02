import neo4j, { Driver, Session } from "neo4j-driver";

let driver: Driver;

export function initDatabase(): Driver {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "vamsha_dev_password";

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 30000,
  });

  return driver;
}

export function getSession(): Session {
  if (!driver) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return driver.session();
}

export function getDriver(): Driver {
  if (!driver) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return driver;
}

export async function closeDatabase(): Promise<void> {
  if (driver) {
    await driver.close();
  }
}
