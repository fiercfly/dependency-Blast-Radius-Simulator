import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/services/[id] - Get service details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        dependencies: true,
        dependents: true,
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json(service);
  } catch (error) {
    console.error("Failed to fetch service:", error);
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 });
  }
}

// PUT /api/services/[id] - Update service details
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, owner, tier, status } = body;

    // Check if service exists
    const existing = await prisma.service.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // If name is changing, ensure it remains unique
    if (name && name !== existing.name) {
      const nameConflict = await prisma.service.findUnique({
        where: { name },
      });
      if (nameConflict) {
        return NextResponse.json({ error: "A service with this name already exists" }, { status: 400 });
      }
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        owner: owner !== undefined ? owner : existing.owner,
        tier: tier !== undefined ? tier : existing.tier,
        status: status !== undefined ? status : existing.status,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

// DELETE /api/services/[id] - Delete service
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if service exists
    const existing = await prisma.service.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Delete service. Implicit relations (dependencies, dependents) are cleaned up by Prisma
    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
