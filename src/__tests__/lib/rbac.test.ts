import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole, SchoolRole } from "@prisma/client";

// vi.mock is hoisted before variable declarations, so mockPrisma must be
// defined with vi.hoisted() to be accessible inside the factory function.
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  mentorship: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  hasAnyRole,
  ensureAuthenticated,
  ensureRole,
  ensureSchoolMembership,
  assertResourceInSchool,
  canMessageUser,
} from "@/lib/rbac";

// Minimal Session shape that satisfies the type
function session(role: UserRole, id = "user-1", orgId = "org-1") {
  return { user: { id, role, organizationId: orgId, name: null, email: null, image: null } };
}

// ── hasAnyRole ─────────────────────────────────────────────────────────────────

describe("hasAnyRole", () => {
  it("returns true when the role is in the list", () => {
    expect(hasAnyRole(UserRole.ADMIN, [UserRole.ADMIN, UserRole.SUPER_ADMIN])).toBe(true);
  });

  it("returns false when the role is not in the list", () => {
    expect(hasAnyRole(UserRole.STUDENT, [UserRole.ADMIN, UserRole.SUPER_ADMIN])).toBe(false);
  });

  it("returns false for an empty allowlist", () => {
    expect(hasAnyRole(UserRole.SUPER_ADMIN, [])).toBe(false);
  });
});

// ── ensureAuthenticated ────────────────────────────────────────────────────────

describe("ensureAuthenticated", () => {
  it("returns the user when the session is valid", () => {
    const s = session(UserRole.STUDENT);
    const user = ensureAuthenticated(s as never);
    expect(user.id).toBe("user-1");
  });

  it("throws Unauthorized when session is null", () => {
    expect(() => ensureAuthenticated(null)).toThrow("Unauthorized");
  });

  it("throws Unauthorized when session.user.id is falsy", () => {
    expect(() =>
      ensureAuthenticated({ user: { id: "", role: UserRole.STUDENT } } as never),
    ).toThrow("Unauthorized");
  });
});

// ── ensureRole ─────────────────────────────────────────────────────────────────

describe("ensureRole", () => {
  it("does not throw when the user role is in the allowed list", () => {
    const user = session(UserRole.ADMIN).user;
    expect(() => ensureRole(user as never, [UserRole.ADMIN, UserRole.SUPER_ADMIN])).not.toThrow();
  });

  it("throws Forbidden when the user role is not in the allowed list", () => {
    const user = session(UserRole.STUDENT).user;
    expect(() => ensureRole(user as never, [UserRole.ADMIN])).toThrow("Forbidden");
  });
});

// ── ensureSchoolMembership ──────────────────────────────────────────────────────

describe("ensureSchoolMembership", () => {
  // Minimal SessionUser carrying school memberships (mirrors the augmented session).
  function schoolUser(
    memberships: Array<{ schoolId: string; role: SchoolRole }>,
    id = "user-1",
  ) {
    return { id, role: UserRole.STUDENT, organizationId: "org-1", schoolMemberships: memberships };
  }

  it("allowed, returns the membership when the user is a member with an allowed role", () => {
    const user = schoolUser([{ schoolId: "school-1", role: SchoolRole.TEACHER }]);
    const membership = ensureSchoolMembership(user as never, "school-1", [SchoolRole.TEACHER]);
    expect(membership).toEqual({ schoolId: "school-1", role: SchoolRole.TEACHER });
  });

  it("allowed, accepts any role in the allowlist (SCHOOL_ADMIN)", () => {
    const user = schoolUser([{ schoolId: "school-1", role: SchoolRole.SCHOOL_ADMIN }]);
    expect(() =>
      ensureSchoolMembership(user as never, "school-1", [SchoolRole.SCHOOL_ADMIN, SchoolRole.TEACHER]),
    ).not.toThrow();
  });

  it("wrong-role, throws Forbidden when the membership role is not allowed", () => {
    const user = schoolUser([{ schoolId: "school-1", role: SchoolRole.TEACHER }]);
    expect(() =>
      ensureSchoolMembership(user as never, "school-1", [SchoolRole.SCHOOL_ADMIN]),
    ).toThrow("Forbidden");
  });

  it("wrong-school, throws Forbidden when the user is a member of a different school", () => {
    const user = schoolUser([{ schoolId: "school-2", role: SchoolRole.TEACHER }]);
    expect(() =>
      ensureSchoolMembership(user as never, "school-1", [SchoolRole.TEACHER]),
    ).toThrow("Forbidden");
  });

  it("no-membership, throws Forbidden when the user has no memberships", () => {
    const user = schoolUser([]);
    expect(() =>
      ensureSchoolMembership(user as never, "school-1", [SchoolRole.TEACHER]),
    ).toThrow("Forbidden");
  });

  it("throws Unauthorized when there is no user", () => {
    expect(() => ensureSchoolMembership(null, "school-1", [SchoolRole.TEACHER])).toThrow("Unauthorized");
    expect(() => ensureSchoolMembership(undefined, "school-1", [SchoolRole.TEACHER])).toThrow("Unauthorized");
  });

  it("picks the correct membership when the user belongs to multiple schools", () => {
    const user = schoolUser([
      { schoolId: "school-1", role: SchoolRole.TEACHER },
      { schoolId: "school-2", role: SchoolRole.SCHOOL_ADMIN },
    ]);
    expect(ensureSchoolMembership(user as never, "school-2", [SchoolRole.SCHOOL_ADMIN])).toEqual({
      schoolId: "school-2",
      role: SchoolRole.SCHOOL_ADMIN,
    });
    expect(() =>
      ensureSchoolMembership(user as never, "school-2", [SchoolRole.TEACHER]),
    ).toThrow("Forbidden");
  });
});

// ── assertResourceInSchool ──────────────────────────────────────────────────────

describe("assertResourceInSchool", () => {
  function schoolUser(memberships: Array<{ schoolId: string; role: SchoolRole }>) {
    return { id: "user-1", role: UserRole.STUDENT, organizationId: "org-1", schoolMemberships: memberships };
  }

  it("does not throw when the resource belongs to the caller's allowed school", () => {
    const user = schoolUser([{ schoolId: "school-1", role: SchoolRole.TEACHER }]);
    expect(() =>
      assertResourceInSchool(user as never, { schoolId: "school-1" }, [SchoolRole.TEACHER]),
    ).not.toThrow();
  });

  it("throws Forbidden when the resource belongs to a different school (tenant isolation)", () => {
    const user = schoolUser([{ schoolId: "school-1", role: SchoolRole.TEACHER }]);
    expect(() =>
      assertResourceInSchool(user as never, { schoolId: "school-2" }, [SchoolRole.TEACHER]),
    ).toThrow("Forbidden");
  });
});

// ── canMessageUser ─────────────────────────────────────────────────────────────

describe("canMessageUser", () => {
  const ORG = "org-1";

  function makeUser(id: string, role: UserRole) {
    return { id, role, organizationId: ORG };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.mentorship.findUnique.mockResolvedValue(null);
  });

  it("returns true when sender and recipient are the same user", async () => {
    expect(await canMessageUser("user-1", "user-1")).toBe(true);
  });

  it("returns false when sender does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser("r", UserRole.STUDENT));
    expect(await canMessageUser("missing", "r")).toBe(false);
  });

  it("returns false when recipient does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(makeUser("s", UserRole.STUDENT)).mockResolvedValueOnce(null);
    expect(await canMessageUser("s", "missing")).toBe(false);
  });

  it("SUPER_ADMIN can message anyone", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(makeUser("sa", UserRole.SUPER_ADMIN))
      .mockResolvedValueOnce(makeUser("p", UserRole.PARENT));
    expect(await canMessageUser("sa", "p")).toBe(true);
  });

  it("ADMIN can message anyone", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(makeUser("a", UserRole.ADMIN))
      .mockResolvedValueOnce(makeUser("st", UserRole.STUDENT));
    expect(await canMessageUser("a", "st")).toBe(true);
  });

  describe("PARENT sender", () => {
    it("can message ADMIN", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("p", UserRole.PARENT))
        .mockResolvedValueOnce(makeUser("a", UserRole.ADMIN));
      expect(await canMessageUser("p", "a")).toBe(true);
    });

    it("cannot message STUDENT", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("p", UserRole.PARENT))
        .mockResolvedValueOnce(makeUser("s", UserRole.STUDENT));
      expect(await canMessageUser("p", "s")).toBe(false);
    });
  });

  describe("STUDENT sender", () => {
    it("can message INSTRUCTOR", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("st", UserRole.STUDENT))
        .mockResolvedValueOnce(makeUser("i", UserRole.INSTRUCTOR));
      expect(await canMessageUser("st", "i")).toBe(true);
    });

    it("can message a FELLOW that mentors them", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("st", UserRole.STUDENT))
        .mockResolvedValueOnce(makeUser("f", UserRole.FELLOW));
      mockPrisma.mentorship.findUnique.mockResolvedValue({ active: true });
      expect(await canMessageUser("st", "f")).toBe(true);
    });

    it("cannot message a FELLOW that does not mentor them", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("st", UserRole.STUDENT))
        .mockResolvedValueOnce(makeUser("f", UserRole.FELLOW));
      mockPrisma.mentorship.findUnique.mockResolvedValue(null);
      expect(await canMessageUser("st", "f")).toBe(false);
    });

    it("cannot message another STUDENT", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("s1", UserRole.STUDENT))
        .mockResolvedValueOnce(makeUser("s2", UserRole.STUDENT));
      expect(await canMessageUser("s1", "s2")).toBe(false);
    });
  });

  describe("FELLOW sender", () => {
    it("can message INSTRUCTOR", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("f", UserRole.FELLOW))
        .mockResolvedValueOnce(makeUser("i", UserRole.INSTRUCTOR));
      expect(await canMessageUser("f", "i")).toBe(true);
    });

    it("can message a STUDENT they mentor", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("f", UserRole.FELLOW))
        .mockResolvedValueOnce(makeUser("st", UserRole.STUDENT));
      mockPrisma.mentorship.findUnique.mockResolvedValue({ active: true });
      expect(await canMessageUser("f", "st")).toBe(true);
    });

    it("cannot message a STUDENT they do not mentor", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("f", UserRole.FELLOW))
        .mockResolvedValueOnce(makeUser("st", UserRole.STUDENT));
      mockPrisma.mentorship.findUnique.mockResolvedValue(null);
      expect(await canMessageUser("f", "st")).toBe(false);
    });

    it("cannot message another FELLOW", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("f1", UserRole.FELLOW))
        .mockResolvedValueOnce(makeUser("f2", UserRole.FELLOW));
      expect(await canMessageUser("f1", "f2")).toBe(false);
    });
  });

  describe("INSTRUCTOR sender", () => {
    it("can message STUDENT", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("i", UserRole.INSTRUCTOR))
        .mockResolvedValueOnce(makeUser("st", UserRole.STUDENT));
      expect(await canMessageUser("i", "st")).toBe(true);
    });

    it("can message FELLOW", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("i", UserRole.INSTRUCTOR))
        .mockResolvedValueOnce(makeUser("f", UserRole.FELLOW));
      expect(await canMessageUser("i", "f")).toBe(true);
    });

    it("can message ADMIN", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("i", UserRole.INSTRUCTOR))
        .mockResolvedValueOnce(makeUser("a", UserRole.ADMIN));
      expect(await canMessageUser("i", "a")).toBe(true);
    });

    it("cannot message PARENT", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser("i", UserRole.INSTRUCTOR))
        .mockResolvedValueOnce(makeUser("p", UserRole.PARENT));
      expect(await canMessageUser("i", "p")).toBe(false);
    });
  });
});
