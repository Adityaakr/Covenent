import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/*
 * The simulator's last computed result, read from the server package's committed snapshot
 * (server/data/simulator/latest.json). The app asks the running server first; this route lets the simulator page
 * show the real-data result even when the server is not running.
 */
export const dynamic = "force-dynamic";

const SERVER_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.COVENANT_SERVER_DIR ?? "../server");

export async function GET() {
  try {
    const raw = await readFile(path.join(SERVER_DIR, "data", "simulator", "latest.json"), "utf8");
    return new NextResponse(raw, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "no simulator snapshot in server/data/simulator" }, { status: 404 });
  }
}
