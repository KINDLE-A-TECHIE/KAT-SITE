import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { PaymentsPanel } from "@/components/dashboard/payments-panel";
import { PageHeader } from "@/components/dashboard/page-header";

const ALLOWED: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PARENT,
  UserRole.STUDENT,
];

export default async function PaymentsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (!ALLOWED.includes(session.user.role as UserRole)) redirect("/dashboard");

  const role = session.user.role as UserRole;
  const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  const isParent = role === UserRole.PARENT;

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Payments"
        title={isAdmin ? "Billing & Payments" : isParent ? "My Children's Payments" : "Payment History"}
        subtitle={
          isAdmin
            ? "Verify transactions, chase unpaid invoices, and manage the academy's full payment records."
            : isParent
              ? "Pay enrolment fees, view receipts, and manage billing for each of your children in one place."
              : "Your past transactions, receipts, and any outstanding invoices."
        }
      />
      <PaymentsPanel role={role} />
    </section>
  );
}
