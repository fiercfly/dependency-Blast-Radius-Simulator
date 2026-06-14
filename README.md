# Dependency Blast Radius Simulator

A modern full-stack simulation dashboard designed to model service dependencies in a distributed system, visualize topology, run real-time failure cascade simulations, calculate blast radius severity scores, and prevent circular dependencies.

## Features

- **Service Registry**: Create, inspect, update, and delete service nodes.
- **Dependency Mapping**: Interactively map dependencies between services.
- **Hierarchical Visualization**: Automatically layout services based on criticality tiers (Tier 1 -> Tier 2 -> Tier 3) from left to right using a React Flow interactive canvas.
- **Real-Time Failure Simulation**: Select one or more service nodes to fail and visually track the downstream cascading impact in real-time.
- **Path Exploration**: Explore the exact propagation pathway that caused any service to fail.
- **Vulnerability Indicators**: Circular dependency detection during connections, visual overlays, and health statistics.
- **Historical Simulation Logs**: Persist and view previous simulation outcomes.

---

## Tech Stack

- **Frontend**: React (Next.js App Router), TypeScript, Vanilla CSS Modules, React Flow (`@xyflow/react`), Lucide Icons.
- **Backend**: Next.js Node.js API Routes, TypeScript.
- **Database & ORM**: PostgreSQL, Prisma ORM, Neon serverless driver adapter with WebSocket support.
- **Testing**: Node.js Native Test Runner, `tsx`.

---

## Setup & Running Guide

Follow these steps to run the application locally:

### 1. Install Dependencies
Make sure you have Node.js (v18+) installed. Clone the repository and install all packages:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require&channel_binding=require"
```
> Get your connection string from [Neon Console](https://console.neon.tech) after creating a project.

### 3. Initialize the Database
Run the Prisma DB setup command to generate the database client and push the schema to the Neon PostgreSQL database:
```bash
npx prisma db push
```

### 4. Run the Development Server
Launch the Next.js local server:
```bash
npm run dev
```
Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

## Running Unit Tests

To run the simulator unit tests (cycle detection, BFS cascade, path exploration, severity scoring):
```bash
npm test
```

---

## Core Assumptions

1. **Failure Propagation Direction**: Failures flow opposite to the dependency direction. If `Gateway` depends on `AuthService`, then a failure in `AuthService` propagates to `Gateway`.
2. **PostgreSQL Database**: Data is persisted on a Neon PostgreSQL instance. Restarting or moving the local server will not erase or reset the data.
3. **Hierarchy Layout**: Node positions are structured dynamically based on Tiers:
   - **Tier 1 (Critical)**: Positioned on the left ($x = 100$)
   - **Tier 2 (Important)**: Positioned in the center ($x = 380$)
   - **Tier 3 (Standard)**: Positioned on the right ($x = 660$)
   - This creates a beautiful, readable flow from left to right.

