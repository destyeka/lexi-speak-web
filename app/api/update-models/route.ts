import { writeFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { models } = body;

    if (!models || !Array.isArray(models)) {
      return NextResponse.json(
        { error: "Invalid models data" },
        { status: 400 }
      );
    }

    // Write to public/models.json
    const filePath = join(process.cwd(), "public", "models.json");
    await writeFile(filePath, JSON.stringify({ models }, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating models:", error);
    return NextResponse.json(
      { error: "Failed to update models" },
      { status: 500 }
    );
  }
}
