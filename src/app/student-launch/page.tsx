import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isSchoolHostHeaders } from "@/lib/request-host";
import { StudentLaunchClient } from "./student-launch-client";

/**
 * The teacher-launch redeemer (Option A) is a SCHOOL-host surface only. This server wrapper 404s it
 * on the B2C apex so a launch token can only ever be redeemed on the school host. The actual
 * redemption UI is the client component.
 */
export default async function StudentLaunchPage() {
  if (!isSchoolHostHeaders(await headers())) notFound();
  return <StudentLaunchClient />;
}
