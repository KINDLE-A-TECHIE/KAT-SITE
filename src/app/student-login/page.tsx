import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isSchoolHostHeaders } from "@/lib/request-host";
import { StudentLoginClient } from "./student-login-client";

/**
 * Pupil sign-in (Option B) is a SCHOOL-host surface only. This server wrapper 404s it on the B2C
 * apex so a school child can never obtain a session, or even see a "student sign-in" entry, on
 * kindleatechie.com. The actual UI is the client component.
 */
export default async function StudentLoginPage() {
  if (!isSchoolHostHeaders(await headers())) notFound();
  return <StudentLoginClient />;
}
