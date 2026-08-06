import { NextResponse } from "next/server";
import { loadOverrides } from "@/lib/studio-audio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public read of permanent studio audio overrides. */
export async function GET() {
  try {
    const overrides = await loadOverrides();
    return NextResponse.json(
      { overrides },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overrides";
    return NextResponse.json({ overrides: {}, error: message }, { status: 200 });
  }
}
