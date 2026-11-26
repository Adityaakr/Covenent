import type { Metadata } from "next";
import "./app.css";
import { AppShell } from "@/components/app/shell";
import { Providers } from "@/components/providers";

export const metadata: Metadata = { title: { default: "App", template: "%s · Covenant" } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
