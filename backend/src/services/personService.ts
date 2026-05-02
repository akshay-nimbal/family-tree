import { v4 as uuidv4 } from "uuid";
import { getSession } from "../config/database";
import {
  PersonInput,
  PersonRecord,
  RelationshipInput,
  SearchResult,
} from "../models/types";

export async function createPerson(input: PersonInput): Promise<PersonRecord> {
  const session = getSession();
  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    const result = await session.run(
      `
      MERGE (f:Family {name: $familyName})
      ON CREATE SET f.id = $familyId
      CREATE (p:Person {
        id: $id,
        fullName: $fullName,
        normalizedName: toLower($fullName),
        familyName: $familyName,
        dateOfBirth: $dateOfBirth,
        dateOfDeath: $dateOfDeath,
        gender: $gender,
        city: $city,
        occupation: $occupation,
        education: $education,
        phone: $phone,
        email: $email,
        linkedinUrl: $linkedinUrl,
        additionalNotes: $additionalNotes,
        status: $status,
        createdAt: $now,
        updatedAt: $now
      })
      CREATE (p)-[:BELONGS_TO_FAMILY]->(f)
      RETURN p
      `,
      {
        id,
        familyId: uuidv4(),
        fullName: input.fullName.trim(),
        familyName: input.familyName.trim(),
        dateOfBirth: input.dateOfBirth || null,
        dateOfDeath: input.dateOfDeath || null,
        gender: input.gender || null,
        city: input.city || null,
        occupation: input.occupation || null,
        education: input.education || null,
        phone: input.phone || null,
        email: input.email || null,
        linkedinUrl: input.linkedinUrl || null,
        additionalNotes: input.additionalNotes || null,
        status: input.status || "verified",
        now,
      }
    );

    return nodeToPersonRecord(result.records[0].get("p").properties);
  } finally {
    await session.close();
  }
}

export async function getPersonById(
  id: string
): Promise<PersonRecord | null> {
  const session = getSession();
  try {
    const result = await session.run(
      "MATCH (p:Person {id: $id}) RETURN p",
      { id }
    );
    if (result.records.length === 0) return null;
    return nodeToPersonRecord(result.records[0].get("p").properties);
  } finally {
    await session.close();
  }
}

export async function updatePerson(
  id: string,
  input: Partial<PersonInput>
): Promise<PersonRecord | null> {
  const session = getSession();
  try {
    const now = new Date().toISOString();
    const setClauses: string[] = ["p.updatedAt = $now"];
    const params: Record<string, unknown> = { id, now };

    const allowedFields = [
      "fullName",
      "dateOfBirth",
      "dateOfDeath",
      "gender",
      "city",
      "occupation",
      "education",
      "phone",
      "email",
      "linkedinUrl",
      "additionalNotes",
      "status",
    ];

    for (const field of allowedFields) {
      if (field in input) {
        const value = (input as Record<string, unknown>)[field];
        params[field] = typeof value === "string" ? value.trim() : value;
        setClauses.push(`p.${field} = $${field}`);
        if (field === "fullName") {
          setClauses.push("p.normalizedName = toLower($fullName)");
        }
      }
    }

    const result = await session.run(
      `MATCH (p:Person {id: $id}) SET ${setClauses.join(", ")} RETURN p`,
      params
    );

    if (result.records.length === 0) return null;
    return nodeToPersonRecord(result.records[0].get("p").properties);
  } finally {
    await session.close();
  }
}

export async function createRelationship(
  input: RelationshipInput
): Promise<void> {
  const session = getSession();
  try {
    const query = buildRelationshipQuery(input.type);
    await session.run(query, {
      fromId: input.fromPersonId,
      toId: input.toPersonId,
      marriageDate: input.marriageDate || null,
    });
  } finally {
    await session.close();
  }
}

function buildRelationshipQuery(type: string): string {
  switch (type) {
    case "FATHER_OF":
      return `
        MATCH (parent:Person {id: $fromId}), (child:Person {id: $toId})
        MERGE (parent)-[:FATHER_OF]->(child)
      `;
    case "MOTHER_OF":
      return `
        MATCH (parent:Person {id: $fromId}), (child:Person {id: $toId})
        MERGE (parent)-[:MOTHER_OF]->(child)
      `;
    case "SPOUSE_OF":
      return `
        MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
        MERGE (a)-[r:SPOUSE_OF]->(b)
        FOREACH (_ IN CASE WHEN $marriageDate IS NOT NULL THEN [1] ELSE [] END |
          SET r.marriageDate = $marriageDate
        )
      `;
    case "SIBLING_OF":
      return `
        MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
        MERGE (a)-[:SIBLING_OF]->(b)
      `;
    default:
      throw new Error(`Unknown relationship type: ${type}`);
  }
}

export async function removeRelationship(
  personAId: string,
  personBId: string,
  type: string
): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      `
      MATCH (a:Person {id: $aId})-[r]->(b:Person {id: $bId})
      WHERE type(r) = $type
      DELETE r
      `,
      { aId: personAId, bId: personBId, type }
    );
    // Also try the reverse direction for bidirectional relationships
    if (type === "SPOUSE_OF" || type === "SIBLING_OF") {
      await session.run(
        `
        MATCH (a:Person {id: $bId})-[r]->(b:Person {id: $aId})
        WHERE type(r) = $type
        DELETE r
        `,
        { aId: personAId, bId: personBId, type }
      );
    }
  } finally {
    await session.close();
  }
}

/**
 * Fuzzy search: the core of the correlation strategy.
 *
 * Uses Neo4j's built-in string functions + Levenshtein-style matching.
 * Scoped by family name to reduce false positives across the 10 families.
 */
export async function searchPersons(
  query: string,
  familyName?: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const session = getSession();
  try {
    const normalizedQuery = query.toLowerCase().trim();
    const familyFilter = familyName
      ? "AND p.familyName = $familyName"
      : "";

    const result = await session.run(
      `
      MATCH (p:Person)
      WHERE (
        p.normalizedName CONTAINS $query
        OR p.normalizedName STARTS WITH $query
        OR p.phone = $rawQuery
        OR p.email = $rawQuery
      )
      ${familyFilter}
      WITH p,
        CASE
          WHEN p.normalizedName = $query THEN 100
          WHEN p.normalizedName STARTS WITH $query THEN 80
          WHEN p.phone = $rawQuery OR p.email = $rawQuery THEN 90
          ELSE 50
        END AS score
      RETURN p, score
      ORDER BY score DESC, p.fullName ASC
      LIMIT $limit
      `,
      {
        query: normalizedQuery,
        rawQuery: query.trim(),
        familyName: familyName || null,
        limit: neo4jInt(limit),
      }
    );

    return result.records.map((record) => ({
      person: nodeToPersonRecord(record.get("p").properties),
      score: typeof record.get("score") === "object"
        ? (record.get("score") as { toNumber(): number }).toNumber()
        : record.get("score"),
      matchReason:
        record.get("score") === 100
          ? "Exact match"
          : record.get("score") === 90
          ? "Phone/email match"
          : "Partial name match",
    }));
  } finally {
    await session.close();
  }
}

/**
 * Check for potential duplicates across ALL families before creating a record.
 * Unlike searchPersons (which is scoped to a family for the autocomplete UX),
 * this deliberately searches globally to catch cross-family duplicates
 * like "Sanskar Betageri" already existing when someone tries to create
 * a pending "Sanskar Betageri" from within the Nimbal family context.
 */
export async function checkDuplicates(
  fullName: string,
  phone?: string,
  email?: string
): Promise<SearchResult[]> {
  const session = getSession();
  try {
    const normalizedName = fullName.toLowerCase().trim();
    const nameParts = normalizedName.split(/\s+/).filter((p) => p.length >= 2);

    const result = await session.run(
      `
      MATCH (p:Person)
      WHERE p.normalizedName = $exactName
        OR ($phone IS NOT NULL AND p.phone = $phone)
        OR ($email IS NOT NULL AND p.email = $email)
        OR ALL(part IN $nameParts WHERE p.normalizedName CONTAINS part)
      WITH p,
        CASE
          WHEN p.normalizedName = $exactName THEN 100
          WHEN $phone IS NOT NULL AND p.phone = $phone THEN 95
          WHEN $email IS NOT NULL AND p.email = $email THEN 95
          WHEN ALL(part IN $nameParts WHERE p.normalizedName CONTAINS part) THEN 85
          ELSE 50
        END AS score
      RETURN p, score
      ORDER BY score DESC, p.fullName ASC
      LIMIT 10
      `,
      {
        exactName: normalizedName,
        phone: phone || null,
        email: email || null,
        nameParts,
      }
    );

    return result.records.map((record) => ({
      person: nodeToPersonRecord(record.get("p").properties),
      score: typeof record.get("score") === "object"
        ? (record.get("score") as { toNumber(): number }).toNumber()
        : record.get("score"),
      matchReason:
        (typeof record.get("score") === "object"
          ? (record.get("score") as { toNumber(): number }).toNumber()
          : record.get("score")) >= 95
          ? "Exact name or contact match"
          : "Name parts match across families",
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get all relationships for a person - the graph neighborhood.
 * Returns the person's immediate family connections with relationship types.
 */
export async function getPersonRelationships(personId: string): Promise<{
  father: PersonRecord | null;
  mother: PersonRecord | null;
  spouses: PersonRecord[];
  children: PersonRecord[];
  siblings: PersonRecord[];
}> {
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (p:Person {id: $id})
      OPTIONAL MATCH (father:Person)-[:FATHER_OF]->(p)
      OPTIONAL MATCH (mother:Person)-[:MOTHER_OF]->(p)
      OPTIONAL MATCH (p)-[:SPOUSE_OF]-(spouse:Person)
      OPTIONAL MATCH (p)-[:FATHER_OF|MOTHER_OF]->(child:Person)
      OPTIONAL MATCH (p)-[:SIBLING_OF]-(sibling:Person)
      RETURN
        father, mother,
        collect(DISTINCT spouse) AS spouses,
        collect(DISTINCT child) AS children,
        collect(DISTINCT sibling) AS siblings
      `,
      { id: personId }
    );

    if (result.records.length === 0) {
      return { father: null, mother: null, spouses: [], children: [], siblings: [] };
    }

    const record = result.records[0];
    const fatherNode = record.get("father");
    const motherNode = record.get("mother");

    return {
      father: fatherNode ? nodeToPersonRecord(fatherNode.properties) : null,
      mother: motherNode ? nodeToPersonRecord(motherNode.properties) : null,
      spouses: (record.get("spouses") as Array<{ properties: Record<string, unknown> }>)
        .filter((n) => n && n.properties)
        .map((n) => nodeToPersonRecord(n.properties)),
      children: (record.get("children") as Array<{ properties: Record<string, unknown> }>)
        .filter((n) => n && n.properties)
        .map((n) => nodeToPersonRecord(n.properties)),
      siblings: (record.get("siblings") as Array<{ properties: Record<string, unknown> }>)
        .filter((n) => n && n.properties)
        .map((n) => nodeToPersonRecord(n.properties)),
    };
  } finally {
    await session.close();
  }
}

/**
 * Find ALL relationship paths between two people (not just shortest).
 * This is where graph DB shines — finding that person A is both
 * uncle (via one path) and brother-in-law (via another).
 *
 * Uses a general variable-length pattern so paths of different lengths
 * are all returned, with a node-uniqueness constraint to avoid cycles.
 */
export async function findRelationshipPaths(
  personAId: string,
  personBId: string,
  maxDepth: number = 8
): Promise<Array<{ path: string[]; relationships: string[] }>> {
  const session = getSession();
  const depth = Math.min(maxDepth, 10);
  try {
    const result = await session.run(
      `
      MATCH path = (a:Person {id: $aId})-[*1..${depth}]-(b:Person {id: $bId})
      WHERE ALL(r IN relationships(path) WHERE type(r) IN ['FATHER_OF','MOTHER_OF','SPOUSE_OF','SIBLING_OF'])
        AND ALL(n IN nodes(path) WHERE single(x IN nodes(path) WHERE x = n))
      RETURN [n IN nodes(path) | n.fullName] AS names,
             [r IN relationships(path) | type(r)] AS rels,
             length(path) AS hops
      ORDER BY hops ASC
      LIMIT 20
      `,
      { aId: personAId, bId: personBId }
    );

    return result.records.map((record) => ({
      path: record.get("names") as string[],
      relationships: record.get("rels") as string[],
    }));
  } finally {
    await session.close();
  }
}

export interface GraphData {
  nodes: Array<{
    id: string;
    fullName: string;
    familyName: string;
    gender: string | null;
    status: string;
    city: string | null;
    occupation: string | null;
    dateOfBirth: string | null;
    dateOfDeath: string | null;
    photoUrl: string | null;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
  families: string[];
}

export async function getFullGraph(): Promise<GraphData> {
  const session = getSession();
  try {
    const nodesResult = await session.run(`
      MATCH (p:Person)
      RETURN p.id AS id, p.fullName AS fullName, p.familyName AS familyName,
             p.gender AS gender, p.status AS status, p.city AS city,
             p.occupation AS occupation, p.dateOfBirth AS dateOfBirth,
             p.dateOfDeath AS dateOfDeath, p.photoUrl AS photoUrl
      ORDER BY p.fullName
    `);

    const edgesResult = await session.run(`
      MATCH (a:Person)-[r]->(b:Person)
      WHERE type(r) IN ['FATHER_OF', 'MOTHER_OF', 'SPOUSE_OF', 'SIBLING_OF']
      RETURN a.id AS source, b.id AS target, type(r) AS type
    `);

    const nodes = nodesResult.records.map((r) => ({
      id: r.get("id") as string,
      fullName: r.get("fullName") as string,
      familyName: r.get("familyName") as string,
      gender: r.get("gender") as string | null,
      status: r.get("status") as string,
      city: r.get("city") as string | null,
      occupation: r.get("occupation") as string | null,
      dateOfBirth: r.get("dateOfBirth") as string | null,
      dateOfDeath: r.get("dateOfDeath") as string | null,
      photoUrl: r.get("photoUrl") as string | null,
    }));

    const families = [...new Set(nodes.map((n) => n.familyName))].sort();

    const edges = edgesResult.records.map((r) => ({
      source: r.get("source") as string,
      target: r.get("target") as string,
      type: r.get("type") as string,
    }));

    return { nodes, edges, families };
  } finally {
    await session.close();
  }
}

export async function getAllFamilies(): Promise<
  Array<{ id: string; name: string; memberCount: number }>
> {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (f:Family)
      OPTIONAL MATCH (p:Person)-[:BELONGS_TO_FAMILY]->(f)
      RETURN f.id AS id, f.name AS name, count(p) AS memberCount
      ORDER BY f.name
    `);

    return result.records.map((record) => ({
      id: record.get("id") as string,
      name: record.get("name") as string,
      memberCount: typeof record.get("memberCount") === "object"
        ? (record.get("memberCount") as { toNumber(): number }).toNumber()
        : record.get("memberCount"),
    }));
  } finally {
    await session.close();
  }
}

export async function getFamilyMembers(
  familyName: string
): Promise<PersonRecord[]> {
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (p:Person)-[:BELONGS_TO_FAMILY]->(f:Family {name: $familyName})
      RETURN p
      ORDER BY p.fullName
      `,
      { familyName }
    );
    return result.records.map((r) =>
      nodeToPersonRecord(r.get("p").properties)
    );
  } finally {
    await session.close();
  }
}

/**
 * Merge a duplicate/pending person record into a verified one.
 * Transfers ALL relationships from the merged node to the kept node,
 * then deletes the merged node.
 *
 * Each relationship type is handled in a separate query to avoid
 * Neo4j issues with OPTIONAL MATCH + DELETE in compound CALL blocks.
 */
export async function mergePersonRecords(
  keepId: string,
  mergeId: string
): Promise<PersonRecord | null> {
  const session = getSession();
  try {
    const exists = await session.run(
      `MATCH (keep:Person {id: $keepId}), (merge:Person {id: $mergeId})
       WHERE keep <> merge
       RETURN keep.id AS kid, merge.id AS mid`,
      { keepId, mergeId }
    );
    if (exists.records.length === 0) return null;

    const transferQueries = [
      `MATCH (keep:Person {id: $keepId}), (merge:Person {id: $mergeId})
       WITH keep, merge
       OPTIONAL MATCH (merge)-[r:FATHER_OF]->(child) WHERE child <> keep
       WITH keep, collect(child) AS children
       FOREACH (c IN children | MERGE (keep)-[:FATHER_OF]->(c))`,

      `MATCH (keep:Person {id: $keepId}), (merge:Person {id: $mergeId})
       WITH keep, merge
       OPTIONAL MATCH (merge)-[r:MOTHER_OF]->(child) WHERE child <> keep
       WITH keep, collect(child) AS children
       FOREACH (c IN children | MERGE (keep)-[:MOTHER_OF]->(c))`,

      `MATCH (keep:Person {id: $keepId}), (merge:Person {id: $mergeId})
       WITH keep, merge
       OPTIONAL MATCH (merge)-[r:SPOUSE_OF]-(spouse) WHERE spouse <> keep
       WITH keep, collect(spouse) AS spouses
       FOREACH (s IN spouses | MERGE (keep)-[:SPOUSE_OF]->(s))`,

      `MATCH (keep:Person {id: $keepId}), (merge:Person {id: $mergeId})
       WITH keep, merge
       OPTIONAL MATCH (merge)-[r:SIBLING_OF]-(sib) WHERE sib <> keep
       WITH keep, collect(sib) AS sibs
       FOREACH (s IN sibs | MERGE (keep)-[:SIBLING_OF]->(s))`,

      `MATCH (keep:Person {id: $keepId}), (merge:Person {id: $mergeId})
       WITH keep, merge
       OPTIONAL MATCH (parent)-[r:FATHER_OF]->(merge) WHERE parent <> keep
       WITH keep, collect(parent) AS parents
       FOREACH (p IN parents | MERGE (p)-[:FATHER_OF]->(keep))`,

      `MATCH (keep:Person {id: $keepId}), (merge:Person {id: $mergeId})
       WITH keep, merge
       OPTIONAL MATCH (parent)-[r:MOTHER_OF]->(merge) WHERE parent <> keep
       WITH keep, collect(parent) AS parents
       FOREACH (p IN parents | MERGE (p)-[:MOTHER_OF]->(keep))`,
    ];

    for (const query of transferQueries) {
      await session.run(query, { keepId, mergeId });
    }

    await session.run(
      `MATCH (merge:Person {id: $mergeId}) DETACH DELETE merge`,
      { mergeId }
    );

    return getPersonById(keepId);
  } finally {
    await session.close();
  }
}

function nodeToPersonRecord(props: Record<string, unknown>): PersonRecord {
  return {
    id: props.id as string,
    fullName: props.fullName as string,
    familyName: props.familyName as string,
    dateOfBirth: (props.dateOfBirth as string) || undefined,
    dateOfDeath: (props.dateOfDeath as string) || undefined,
    gender: props.gender as PersonRecord["gender"],
    city: (props.city as string) || undefined,
    occupation: (props.occupation as string) || undefined,
    education: (props.education as string) || undefined,
    phone: (props.phone as string) || undefined,
    email: (props.email as string) || undefined,
    linkedinUrl: (props.linkedinUrl as string) || undefined,
    additionalNotes: (props.additionalNotes as string) || undefined,
    status: (props.status as PersonRecord["status"]) || "verified",
    photoUrl: (props.photoUrl as string) || undefined,
    createdAt: props.createdAt as string,
    updatedAt: props.updatedAt as string,
  };
}

function neo4jInt(value: number) {
  const neo4j = require("neo4j-driver");
  return neo4j.int(value);
}
