import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectCycle, ServiceNode } from "@/lib/simulator";

// POST /api/services/[id]/dependencies - Add a dependency (id depends on dependencyId)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { dependencyId } = body;

    if (!dependencyId) {
      return NextResponse.json({ error: "Missing dependencyId" }, { status: 400 });
    }

    if (id === dependencyId) {
      return NextResponse.json({ error: "A service cannot depend on itself" }, { status: 400 });
    }

    // Load graph to check for cycles
    const allServices = await prisma.service.findMany({
      include: {
        dependencies: true,
        dependents: true,
      },
    });

    const servicesMap: Record<string, ServiceNode> = {};
    for (const s of allServices) {
      servicesMap[s.id] = {
        id: s.id,
        name: s.name,
        tier: s.tier,
        status: s.status,
        dependencies: s.dependencies.map((d) => d.id),
        dependents: s.dependents.map((d) => d.id),
      };
    }

    // Verify both nodes exist
    if (!servicesMap[id] || !servicesMap[dependencyId]) {
      return NextResponse.json({ error: "One or both services do not exist" }, { status: 404 });
    }

    // Run cycle detection: If we make 'id' depend on 'dependencyId', does it create a cycle?
    // detectCycle checks if 'dependencyId' can reach 'id'.
    const cycle = detectCycle(servicesMap, id, dependencyId);

    if (cycle) {
      // Get the names of services in the cycle to display to the user
      const cycleNames = cycle.map((nodeId) => servicesMap[nodeId]?.name || nodeId);
      return NextResponse.json(
        {
          error: "Circular dependency detected",
          cycle,
          cycleNames,
        },
        { status: 400 }
      );
    }

    // Create relation
    const updated = await prisma.service.update({
      where: { id },
      data: {
        dependencies: {
          connect: { id: dependencyId },
        },
      },
      include: {
        dependencies: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to add dependency:", error);
    return NextResponse.json({ error: "Failed to add dependency" }, { status: 500 });
  }
}

// DELETE /api/services/[id]/dependencies - Remove a dependency (id no longer depends on dependencyId)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { dependencyId } = body;

    if (!dependencyId) {
      return NextResponse.json({ error: "Missing dependencyId" }, { status: 400 });
    }

    // Check if the service exists
    const existing = await prisma.service.findUnique({
      where: { id },
      include: { dependencies: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Remove relation
    const updated = await prisma.service.update({
      where: { id },
      data: {
        dependencies: {
          disconnect: { id: dependencyId },
        },
      },
      include: {
        dependencies: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to remove dependency:", error);
    return NextResponse.json({ error: "Failed to remove dependency" }, { status: 500 });
  }
}
