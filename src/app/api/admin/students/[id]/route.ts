import { NextResponse } from "next/server";

import { fail, handle, noStore, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import { deleteStudent, setStudentActive } from "@/lib/services/admin";
import { recomputeRanks, syncStudentAndRerank } from "@/lib/services/sync";
import { studentIdParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Action = "disable" | "enable" | "resync";

/**
 * PATCH /api/admin/students/:id — disable, re-enable, or force a refresh.
 * Body: `{ "action": "disable" | "enable" | "resync" }`
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handle("admin.students.patch", async () => {
    await requireAdmin();

    const { id } = await context.params;
    const parsedId = studentIdParamSchema.safeParse(id);
    if (!parsedId.success) return fail(400, "Invalid student.", { code: "VALIDATION_FAILED" });

    let body: { action?: Action };
    try {
      body = (await request.json()) as { action?: Action };
    } catch {
      return fail(400, "Expected a JSON body.", { code: "INVALID_JSON" });
    }

    switch (body.action) {
      case "disable":
        await setStudentActive(parsedId.data, false);
        await recomputeRanks();
        return noStore(ok({ ok: true, action: "disable" }));
      case "enable":
        await setStudentActive(parsedId.data, true);
        await recomputeRanks();
        return noStore(ok({ ok: true, action: "enable" }));
      case "resync": {
        const result = await syncStudentAndRerank(parsedId.data);
        return noStore(ok({ ok: result.status !== "FAILED", action: "resync", status: result.status }));
      }
      default:
        return fail(400, "Unknown action.", { code: "VALIDATION_FAILED" });
    }
  });
}

/** DELETE /api/admin/students/:id — removes the student and all their history. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handle("admin.students.delete", async () => {
    await requireAdmin();

    const { id } = await context.params;
    const parsedId = studentIdParamSchema.safeParse(id);
    if (!parsedId.success) return fail(400, "Invalid student.", { code: "VALIDATION_FAILED" });

    await deleteStudent(parsedId.data);
    await recomputeRanks();

    return noStore(ok({ ok: true }));
  });
}
