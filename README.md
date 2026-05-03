# वंश · Vamsha — Family Heritage Tracker

A Next.js application for recording and exploring complex, intermarried family
histories spanning generations. Built on a **graph database** to naturally
represent the web of relationships where one person can be an uncle from one
side and a brother-in-law from another.

## Architecture

```
┌────────────────────────────────────┐     ┌──────────────┐
│          Next.js 15 (TS)           │────▶│    Neo4j     │
│  React UI  +  App Router API       │     │  Graph DB    │
│           Port 3000                │     │  Port 7687   │
└────────────────────────────────────┘     └──────────────┘
           Single process                    Database
```

Everything runs in one Node process: the UI is rendered by React client
components, data fetching hits `/api/*` route handlers in the same app, and
those handlers talk to Neo4j over Bolt.

### Why these choices?

| Decision | Rationale |
|----------|-----------|
| **Neo4j (Graph DB)** | Family data is fundamentally a graph. "Find all paths between A and B" is a single Cypher query. In SQL, this needs recursive CTEs that explode in complexity for intermarried families. |
| **Next.js 15 (App Router)** | Single runtime for UI + API. File-based routing, React 19, built-in TypeScript, and zero CORS between frontend and backend. |
| **neo4j-driver (native)** | Connection pool is stashed on `globalThis` so HMR doesn't leak pools. |

### Data model

```
(:Person)-[:FATHER_OF]->(:Person)
(:Person)-[:MOTHER_OF]->(:Person)
(:Person)-[:SPOUSE_OF]-(:Person)
(:Person)-[:SIBLING_OF]-(:Person)
(:Person)-[:BELONGS_TO_FAMILY]->(:Family)
```

Each `Person` carries: `fullName`, `familyName`, DOB, DOD, gender, city,
occupation, education, phone, email, LinkedIn, notes, status
(`verified` / `pending`), timestamps.

### The correlation problem

When Person A types their father's name, they might spell it differently than
when the father registered himself. Our strategy:

1. **Search-then-select (not free-text)**: Users search existing records via
   autocomplete and *pick* from matches rather than typing names freely.
2. **Fuzzy matching**: Case-insensitive substring matching, plus exact
   phone/email matching as secondary identifiers.
3. **Pending records**: If a relative hasn't registered yet, the user creates
   a pending placeholder. When that person later registers, they claim and
   merge the pending record, preserving all graph edges.
4. **Family scoping**: Searches can be scoped to a family name, dramatically
   reducing false matches across the ~10 families.
5. **UUID as truth**: Every person gets a system UUID. Phone numbers act as
   secondary keys for living members; merging handles deduplication.

## Getting started

### Prerequisites

- **Docker or Podman** (for Neo4j)
- **Node.js 20+**
- **npm**

### 1. Start Neo4j

```bash
docker compose up -d          # or: podman-compose up -d
```

Wait for the container to go healthy (~30s). The Neo4j browser is at
<http://localhost:7474> (login: `neo4j` / `vamsha_dev_password`).

### 2. Configure environment

```bash
cp .env.example .env.local
# edit if you changed Neo4j credentials
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### 4. (Optional) Seed demo data

Loads a richly intermarried 5-family, 6-generation dataset — perfect for
stress-testing the "find all paths" feature. Deletes all existing Person
and Family nodes first.

```bash
npm run seed
```

## Routes

### UI

| URL | Component |
|---|---|
| `/` | Family Graph (D3, generational layout) |
| `/add` | Add Member form |
| `/browse` | Family & Person Browser |
| `/browse?person=<uuid>` | Browser pre-selecting a person |
| `/paths` | Find relationship paths between two people |

### API (`app/api/…`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/persons` | Create a person |
| `GET` | `/api/persons/search?q=&family=&limit=` | Fuzzy search |
| `GET` | `/api/persons/check-duplicates?name=&phone=&email=` | Cross-family duplicate scan |
| `GET` | `/api/persons/:id` | Get person |
| `PATCH` | `/api/persons/:id` | Update person |
| `GET` | `/api/persons/:id/relationships` | Neighbourhood (parents, spouses, children, siblings) |
| `GET` | `/api/persons/:id/paths/:otherId` | All relationship paths between two people |
| `POST` | `/api/persons/relationships` | Create an edge |
| `DELETE` | `/api/persons/relationships` | Remove an edge |
| `POST` | `/api/persons/:id/merge/:mergeId` | Merge duplicate records |
| `GET` | `/api/families` | List families (with member counts) |
| `GET` | `/api/families/graph` | Full graph dump for the visualisation |
| `GET` | `/api/families/:name/members` | People in one family |
| `POST` | `/api/photos/:personId` | Upload a profile photo (multipart) |
| `GET` | `/uploads/<filename>` | Serve a stored photo |

## Project structure

```
family-tree/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # html/body, globals.css, chrome
│   │   ├── globals.css           # full application stylesheet
│   │   ├── page.tsx              # / (Family Graph)
│   │   ├── add/page.tsx          # /add
│   │   ├── browse/page.tsx      # /browse (reads ?person=)
│   │   ├── paths/page.tsx       # /paths
│   │   ├── api/                  # Route handlers (see table above)
│   │   └── uploads/[...path]/    # Serves stored photos
│   ├── components/               # React client components
│   ├── server/                   # Server-only libs
│   │   ├── neo4j.ts              # Driver singleton + schema init
│   │   ├── personService.ts      # All Cypher queries live here
│   │   ├── validation.ts         # Pure input validators
│   │   └── uploads.ts            # MIME allow-list, path safety
│   ├── api/client.ts             # Frontend HTTP client (same-origin)
│   └── types/index.ts            # Shared TS types
├── scripts/seed.ts               # Demo data seeder (`npm run seed`)
├── public/                       # Static assets
├── uploads/                      # User-uploaded photos (gitignored)
├── docker-compose.yml            # Neo4j
├── next.config.ts
├── tsconfig.json
├── .env.example
└── package.json
```

## Dev notes

- The Neo4j driver lives on `globalThis` so Next.js HMR cycles don't leak
  connection pools. See `src/server/neo4j.ts`.
- Schema constraints/indexes are created lazily the first time any API
  handler runs (`ensureSchema()`), not at boot — there's no Next.js
  equivalent of Express' startup hook.
- Photo uploads go through `multipart/form-data` → `request.formData()` →
  `fs.writeFile`. File extensions are derived from the validated MIME type,
  not the user-supplied filename.
- `/uploads/<filename>` is served by a Next.js route handler (not
  `express.static`) with path-traversal guards and an aggressive
  `Cache-Control: immutable` header (filenames are random UUIDs).

## Future: LLM chatbot integration

The graph database is ideal for RAG (Retrieval-Augmented Generation):

1. **Query understanding** — LLM parses natural language
   ("Who is Ramesh's uncle?") into Cypher.
2. **Graph traversal** — Neo4j executes the traversal and returns structured
   results.
3. **Response generation** — LLM formats the graph data into natural
   language with full context.

Person nodes already capture LinkedIn, career, and education data — rich
context for the LLM to draw on.
