# वंश · Vamsha — Family Heritage Tracker

A full-stack application for recording and exploring complex, intermarried family histories spanning generations. Built on a **graph database** to naturally represent the web of relationships where one person can be an uncle from one side and a brother-in-law from another.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   React + TS    │────▶│  Express + TS   │────▶│    Neo4j     │
│   (Vite)        │     │  REST API       │     │  Graph DB    │
│   Port 5173     │     │  Port 3001      │     │  Port 7687   │
└─────────────────┘     └─────────────────┘     └──────────────┘
      Frontend              Backend              Database
```

### Why These Choices?

| Decision | Rationale |
|----------|-----------|
| **Neo4j (Graph DB)** | Family data is fundamentally a graph. "Find all paths between A and B" is a single Cypher query. In SQL, this needs recursive CTEs that explode in complexity for intermarried families. |
| **React + TypeScript** | Rich ecosystem for interactive UIs. TypeScript catches type errors early. Future graph visualization (D3, vis-network) integrates seamlessly. |
| **Node.js + Express** | Shares types with frontend. Fast I/O. Easy to bolt on LLM APIs (OpenAI, LangChain) for the chatbot phase. |

### Data Model

```
(:Person)-[:FATHER_OF]->(:Person)
(:Person)-[:MOTHER_OF]->(:Person)
(:Person)-[:SPOUSE_OF]-(:Person)
(:Person)-[:SIBLING_OF]-(:Person)
(:Person)-[:BELONGS_TO_FAMILY]->(:Family)
```

Each Person node carries: fullName, familyName, DOB, DOD, gender, city, occupation, education, phone, email, LinkedIn, notes, status (verified/pending), timestamps.

### The Correlation Problem & Solution

The biggest challenge: when Person A types their father's name, they might spell it differently than when the father registered himself. Our strategy:

1. **Search-then-select (not free-text)**: When entering family connections, users search existing records via autocomplete. They *pick* from matches rather than typing names freely.

2. **Fuzzy matching**: The search uses case-insensitive substring matching, plus exact phone/email matching as secondary identifiers.

3. **Pending records**: If a relative hasn't registered yet, the user creates a "pending" placeholder. When that person later registers, they claim and merge the pending record, preserving all graph edges.

4. **Family scoping**: Searches can be scoped to a family name, dramatically reducing false matches across the ~10 families.

5. **UUID as truth**: Every person gets a system UUID. Phone numbers are secondary keys for living members. For deceased ancestors (no phone), the search-then-select + merge flow handles deduplication.

## Getting Started

### Prerequisites

- **Docker** (for Neo4j)
- **Node.js 20+**
- **npm**

### 1. Start Neo4j

```bash
docker compose up -d
```

Wait for Neo4j to be healthy (~30 seconds). You can access the Neo4j browser at http://localhost:7474 (login: neo4j / vamsha_dev_password).

### 2. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The API will be available at http://localhost:3001. It auto-initializes the Neo4j schema on first run.

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Features

### Add Family Member
- Comprehensive data collection form (name, DOB, city, occupation, education, phone, email, LinkedIn, notes)
- Family name selection with ability to create new families
- **Autocomplete search** for linking to father, mother, spouse, children, siblings
- Creates "pending" placeholder records for relatives who haven't registered yet

### Browse Families
- View all families with member counts
- Drill into a family to see all members
- View detailed profile for any person including all family connections
- Navigate between connected family members

### Find Connections
- Select two people and discover ALL relationship paths between them
- Reveals the multi-path connections (uncle AND brother-in-law via different routes)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/persons | Create a person |
| GET | /api/persons/search?q=&family= | Fuzzy search |
| GET | /api/persons/:id | Get person by ID |
| PATCH | /api/persons/:id | Update person |
| GET | /api/persons/:id/relationships | Get family connections |
| GET | /api/persons/:id/paths/:otherId | Find all paths between two people |
| POST | /api/persons/relationships | Create a relationship |
| POST | /api/persons/:id/merge/:mergeId | Merge duplicate records |
| GET | /api/families | List all families |
| GET | /api/families/:name/members | Get family members |

## Future: LLM Chatbot Integration

The graph database is ideal for RAG (Retrieval-Augmented Generation):

1. **Query understanding**: LLM parses natural language ("Who is Ramesh's uncle?") into Cypher queries
2. **Graph traversal**: Neo4j executes the traversal and returns structured results
3. **Response generation**: LLM formats the graph data into natural language with full context

The Person nodes already capture LinkedIn, career, education data — providing rich context for the LLM to draw from when answering questions about family history.

## Project Structure

```
family-tree/
├── backend/
│   └── src/
│       ├── config/       # Neo4j connection and schema init
│       ├── middleware/    # Input validation
│       ├── models/       # TypeScript interfaces
│       ├── routes/       # Express route handlers
│       ├── services/     # Business logic (CRUD, search, merge)
│       └── server.ts     # Express app entry point
├── frontend/
│   └── src/
│       ├── api/          # HTTP client
│       ├── components/   # PersonForm, PersonSearch, FamilyBrowser, PathFinder
│       ├── types/        # Shared TypeScript types
│       ├── App.tsx       # Main app with tab navigation
│       └── App.css       # Complete styling
├── docker-compose.yml    # Neo4j container
└── README.md
```
