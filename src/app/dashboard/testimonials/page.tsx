import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { ParentTestimonialsPanel } from "@/components/dashboard/testimonials-panel";
import { AdminTestimonialsPanel } from "@/components/dashboard/testimonials-panel";

export default async function TestimonialsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  if (role === "PARENT") {
    return (
      <section className="space-y-4">
        <PageHeader
          badge="Testimonials"
          title="Share your experience"
          subtitle="Tell us about your child's journey with KAT. Approved testimonials may appear on our website."
        />
        <ParentTestimonialsPanel />
      </section>
    );
  }

  if (role === "SUPER_ADMIN") {
    return (
      <section className="space-y-4">
        <PageHeader
          badge="Testimonials"
          title="Testimonials review"
          subtitle="Approve or reject parent testimonials before they appear on the landing page."
        />
        <AdminTestimonialsPanel />
      </section>
    );
  }

  redirect("/dashboard");
}
