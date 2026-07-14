import type { Metadata } from "next";
import { SchoolsLanding } from "@/components/marketing/schools/schools-landing";

export const metadata: Metadata = {
  title: "KAT for Schools: NERDC-aligned coding & robotics your teachers deliver",
  description:
    "License a complete, NERDC-mapped Digital Technologies curriculum for your school. Compliant from Primary 1 to SS3, delivered by your own teachers. No specialist hire, no lab. Request a pilot.",
};

export default function SchoolsPage() {
  return <SchoolsLanding />;
}
