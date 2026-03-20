import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { WaitlistPanel } from "@/components/dashboard/waitlist-panel";

export const metadata = { title: "Waitlist — KAT Learning" };

export default async function WaitlistPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  return <WaitlistPanel />;
}
