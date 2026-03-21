import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Public endpoint — no auth required
export const revalidate = 300; // 5-minute ISR

export async function GET() {
  const projects = await prisma.project.findMany({
    where: { status: "APPROVED" },
    include: {
      student: { select: { firstName: true, lastName: true } },
      program: { select: { name: true } },
      files: { select: { id: true, name: true, mimeType: true, url: true }, take: 1 },
      assets: { select: { id: true, name: true, mimeType: true, url: true, description: true }, orderBy: { uploadedAt: "asc" } },
      _count: { select: { files: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return ok({ projects });
}
