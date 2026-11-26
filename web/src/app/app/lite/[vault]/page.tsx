"use client";

import { useParams } from "next/navigation";
import { LitePage } from "@/components/app/lite";

export default function LiteVaultPage() {
  const { vault } = useParams<{ vault: string }>();
  return <LitePage vault={vault} />;
}
