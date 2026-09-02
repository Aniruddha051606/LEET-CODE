import { NextResponse } from "next/server";

import { fail, handle, noStore, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import { listStudents } from "@/lib/services/admin";
import { adminStudentQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/admin/students — paginated roster with sync state. Admin only. */
export async function GET(request: Request): Promise<NextResponse> {
  return handle("admin.students.list", async () => {
    await requireAdmin();

    const url = new URL(request.url);
    const parsed = adminStudentQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      onlyFailed: url.searchParams.get("onlyFailed") ?? undefined,
    });

    if (!parsed.success) return fail(400, "Invalid query.", { code: "VALIDATION_FAILED" });

    return noStore(ok(await listStudents(parsed.data)));
  });
}
