import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/simulations - Get all historical simulation outcomes
export async function GET() {
  try {
    const history = await prisma.simulationHistory.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Parse the JSON string arrays for output
    const parsedHistory = history.map((item) => ({
      ...item,
      failedServiceIds: JSON.parse(item.failedServiceIds),
      impactedServiceIds: JSON.parse(item.impactedServiceIds),
    }));

    return NextResponse.json(parsedHistory);
  } catch (error) {
    console.error("Failed to fetch simulation history:", error);
    return NextResponse.json({ error: "Failed to fetch simulation history" }, { status: 500 });
  }
}

// POST /api/simulations - Log a simulation result
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { failedServiceIds, impactedServiceIds, severityScore, systemImpactedPercent, notes } = body;

    if (!failedServiceIds || !Array.isArray(failedServiceIds)) {
      return NextResponse.json({ error: "Missing failedServiceIds array" }, { status: 400 });
    }

    if (!impactedServiceIds || !Array.isArray(impactedServiceIds)) {
      return NextResponse.json({ error: "Missing impactedServiceIds array" }, { status: 400 });
    }

    const saved = await prisma.simulationHistory.create({
      data: {
        failedServiceIds: JSON.stringify(failedServiceIds),
        impactedServiceIds: JSON.stringify(impactedServiceIds),
        severityScore: Number(severityScore) || 0,
        systemImpactedPercent: Number(systemImpactedPercent) || 0,
        notes: notes || "",
      },
    });

    return NextResponse.json({
      ...saved,
      failedServiceIds: JSON.parse(saved.failedServiceIds),
      impactedServiceIds: JSON.parse(saved.impactedServiceIds),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to save simulation history:", error);
    return NextResponse.json({ error: "Failed to save simulation history" }, { status: 500 });
  }
}
