import { NextResponse } from "next/server";

import { handle, noStore, ok } from "@/lib/api";
import { logout } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/** POST /api/admin/logout */
export async function POST(): Promise<NextResponse> {
  return handle("admin.logout", async () => {
    await logout();
    return noStore(ok({ ok: true }));
  });
}
