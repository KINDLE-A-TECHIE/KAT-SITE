import { prisma } from "./prisma";

const DEFAULT_ORGANIZATION_CODE = process.env.DEFAULT_ORGANIZATION_CODE?.trim() || "KAT-ORG";
const DEFAULT_ORGANIZATION_NAME = process.env.DEFAULT_ORGANIZATION_NAME?.trim() || "KAT Academy";
const DEFAULT_ORGANIZATION_DOMAIN = process.env.DEFAULT_ORGANIZATION_DOMAIN?.trim();

export async function ensureDefaultOrganization() {
  return prisma.organization.upsert({
    where: { code: DEFAULT_ORGANIZATION_CODE },
    update: {
      name: DEFAULT_ORGANIZATION_NAME,
      ...(DEFAULT_ORGANIZATION_DOMAIN ? { domain: DEFAULT_ORGANIZATION_DOMAIN } : {}),
    },
    create: {
      code: DEFAULT_ORGANIZATION_CODE,
      name: DEFAULT_ORGANIZATION_NAME,
      domain: DEFAULT_ORGANIZATION_DOMAIN || undefined,
    },
    select: { id: true, code: true, name: true, domain: true },
  });
}

