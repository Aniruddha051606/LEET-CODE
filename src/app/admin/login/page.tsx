import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { Card } from "@/components/ui/card";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");

  const configured = isAdminConfigured();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-14">
      <div className="mb-6 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-surface-muted text-muted">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-1.5 text-sm text-muted">
          Challenge administration for organisers.
        </p>
      </div>

      <Card className="p-6">
        {configured ? (
          <AdminLoginForm />
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-hard">Admin access is not configured.</p>
            <p className="text-muted">
              Set <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">ADMIN_PASSWORD_HASH</code>{" "}
              and{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
                ADMIN_SESSION_SECRET
              </code>{" "}
              in the environment, then restart. Generate both with{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
                npm run admin:hash -- &quot;your-password&quot;
              </code>
              .
            </p>
            <p className="text-xs text-subtle">
              Until they are set, every login is refused and the admin area stays locked.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
