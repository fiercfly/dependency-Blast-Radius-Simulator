import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/services - Retrieve all services
export async function GET() {
  try {
    const services = await prisma.service.findMany({
      include: {
        dependencies: {
          select: { id: true, name: true }
        },
        dependents: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

// POST /api/services - Create a new service
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, owner, tier } = body;

    if (!name || !owner || !tier) {
      return NextResponse.json({ error: "Missing required fields (name, owner, tier)" }, { status: 400 });
    }

    // Check for unique name
    const existing = await prisma.service.findUnique({
      where: { name }
    });

    if (existing) {
      return NextResponse.json({ error: "A service with this name already exists" }, { status: 400 });
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || "",
        owner,
        tier,
        status: "HEALTHY" // Default status is HEALTHY
      }
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Failed to create service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
