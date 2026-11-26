import { askPost, askStatus } from "./handler";

/* Ask AI (lib/ai): Claude with Covenant's read tools and unsigned-transaction builders. Never signs. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET() {
  return askStatus();
}

export function POST(req: Request) {
  return askPost(req);
}
