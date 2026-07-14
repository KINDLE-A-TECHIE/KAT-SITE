import type { Metadata } from "next";
import { DeveloperDocs } from "@/components/marketing/schools/developer-docs";

/**
 * Public developer documentation for KAT for Schools.
 *
 * Deliberately on the MARKETING host (kindleatechie.com/schools/developers), not behind the school
 * login: a school's IT contractor must be able to read it, and cost it, before anyone has an
 * account. The API it documents lives on schools.kindleatechie.com.
 */
export const metadata: Metadata = {
  title: "Developer docs | KAT for Schools",
  description:
    "Sync your roster, read progress and results, receive webhooks, and sign pupils into their lessons from your own portal. REST API, API keys, magic-link SSO.",
};

export default function SchoolsDevelopersPage() {
  return <DeveloperDocs />;
}
