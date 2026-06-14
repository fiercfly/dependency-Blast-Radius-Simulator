# Dependency Blast Radius Simulator - System Architecture

This document describes the design decisions, component interactions, scalability considerations, and resilience strategies for the Dependency Blast Radius Simulator.

## System Components & Interaction

The system is architected as a unified Next.js App Router application written in TypeScript:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React Frontend (Client)                       │
│───────────────────────────────────┬────────────────────────────────────┤
│   Service Registry UI (CRUD)      │   React Flow Canvas (Graph view)   │
│───────────────────────────────────┴────────────────────────────────────┤
│                     Failure Simulation Control                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                HTTP REST
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Next.js API Routes (Node.js Backend)                │
├────────────────────────────────────────────────────────────────────────┤
│   Services Controller (CRUD)                                           │
│   Dependency Controller (with Cycle Detection validation)             │
│   Simulations Controller (History logging)                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                Prisma ORM
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Neon PostgreSQL Serverless Database                 │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Interactive Visualization Engine (React Flow)**: Rendered client-side, translating services into nodes and dependencies into directed edges. Node statuses glow (green/yellow/red) based on active simulation states.
2. **Failure Simulation Engine**: Executes failure cascade calculations on demand. While the frontend does this in real-time for instantaneous user updates, the backend validates inputs, runs the cascade logic, and persists results to the database.
3. **Database Layer (Neon PostgreSQL & Prisma)**: A remote Neon PostgreSQL database is utilized, managed via Prisma ORM using standard relational schema representations. The connection uses the Neon serverless database client adapter with WebSocket support for serverless connections.

---

## Key Algorithms & Mathematical Formulas

### 1. Failure Cascade Propagation (BFS)
Failures propagate along the **reverse** direction of service dependency edges. (If service A depends on service B, and B fails, the failure propagates from B to A).
- **Initialization**: A queue `Q` is seeded with all initially failed service IDs. A path tracker map `P` records paths, initializing `P[id] = [id]` for each seed.
- **Iteration**: For each service `U` dequeued:
  - We fetch the list of services `V` that depend on `U` (dependents).
  - For each unvisited dependent `v`, we update its path: `P[v] = [...P[u], v]`, flag it as failed/impacted, and enqueue `v`.
  - This guarantees that the path stored represents the shortest cascading pathway of failure.

### 2. Blast Radius Severity Scoring
The severity of a failure is a weighted metric indicating the impact relative to the entire ecosystem size and service criticality.
- Each service is assigned a tier-based criticality weight:
  - **Tier 1 (Critical Gateway / Core Auth)**: Weight = 3
  - **Tier 2 (Important API Services)**: Weight = 2
  - **Tier 3 (Standard Databases / Helpers)**: Weight = 1
- **Severity Score Formula**:
  $$\text{Severity Score} = \left( \frac{\sum_{i \in \text{Affected}} \text{Weight}_i}{\sum_{j \in \text{All}} \text{Weight}_j} \right) \times 100$$
- This yields a score between `0%` and `100%`, giving engineering teams a clear risk indicator.

### 3. Circular Dependency Detection (DFS)
To prevent infinite recursion cascades, we run cycle detection before adding any new dependency edge `A -> B` (A depends on B).
- A cycle is created if there is already a directed path from `B` to `A` in the existing graph.
- We run a depth-first search (DFS) starting at `B`. If `A` is reached, we trace back the visited parents and return the exact circular path (e.g. `A -> B -> C -> A`) to display to the user, blocking database write operations with a `400 Bad Request`.

---

## Design Trade-offs

1. **Monolithic Next.js vs. Microservices Architecture**:
   - *Choice*: Next.js monolithic setup.
   - *Rationale*: A monolithic workspace allows for a single repository, zero complex configuration for the reviewer, single-process dev startup (`npm run dev`), and simplified deployment.
2. **PostgreSQL vs. SQLite**:
   - *Choice*: PostgreSQL via Neon serverless platform.
   - *Rationale*: PostgreSQL allows for concurrent transactions, fully typed relational constraints, and offloads state persistence from local dev machines, ensuring that closing or changing local servers does not result in data loss.
3. **Implicit Relations vs. Explicit Join Tables**:
   - *Choice*: Implicit many-to-many relationship (`dependencies Service[] @relation("ServiceDependencies")`).
   - *Rationale*: Prisma handles many-to-many relationship tables automatically, keeping the migrations clean and queries concise.

---

## Scalability & Production-Ready Considerations

In a real enterprise environment with thousands of services:
1. **Graph Database**: Neon PostgreSQL tables would be replaced with a Graph Database like **Neo4j** or **AWS Neptune**. Cycles and shortest paths are computed natively in Cypher queries, avoiding loading the entire graph into application memory.
2. **Caching**: Pre-calculating blast radius vectors for known services and caching them in Redis.
3. **Queueing**: Asynchronous failure simulations processed using background workers (e.g., BullMQ, Celery).
