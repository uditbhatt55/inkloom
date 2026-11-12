import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { safeNext } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · INKLOOM AI" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl leading-none font-semibold">Sign in to INKLOOM AI</h1>
          <CardDescription>Check content against your brand before it is published.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={safeNext(next)} />
        </CardContent>
      </Card>
    </main>
  );
}
