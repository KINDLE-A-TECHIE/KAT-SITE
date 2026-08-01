import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "../legal-layout";

export const metadata: Metadata = {
  title: "Cookie Policy. KAT Learning",
  description: "How KAT Learning uses cookies on its platform.",
};

const sections: LegalSection[] = [
  {
    id: "what-are-cookies",
    title: "What are cookies?",
    body: (
      <p>
        Cookies are small text files stored on your device when you visit a website. They allow the
        site to remember information about your visit, like whether you are logged in, so you do
        not have to repeat yourself on every page load.
      </p>
    ),
  },
  {
    id: "how-we-use-cookies",
    title: "How KAT Learning uses cookies",
    body: (
      <>
        <p>
          KAT Learning uses only <strong>strictly necessary cookies</strong>. We do not use advertising
          cookies, tracking cookies, or any third-party analytics tools (such as Google Analytics or
          similar). Below is a complete list of every cookie we set.
        </p>

        <h3>Session cookie (authentication)</h3>
        <p>
          When you sign in, NextAuth sets an encrypted, HTTP-only session cookie that keeps you logged
          in as you navigate the platform. This cookie is never accessible to JavaScript and is deleted
          when your session expires or you sign out.
        </p>
        <ul>
          <li><strong>Name:</strong> <code>next-auth.session-token</code> (or <code>__Secure-next-auth.session-token</code> on HTTPS)</li>
          <li><strong>Purpose:</strong> Authentication, identifies your active session</li>
          <li><strong>Duration:</strong> Until sign-out or session expiry</li>
          <li><strong>Third-party:</strong> No</li>
        </ul>

        <h3>OAuth role cookie</h3>
        <p>
          When a new user registers via Google OAuth, a temporary cookie records whether they signed up
          as a Parent or a Student. It is used only during the OAuth redirect and deleted immediately
          after the account is created.
        </p>
        <ul>
          <li><strong>Name:</strong> <code>oauth_register_role</code></li>
          <li><strong>Purpose:</strong> Stores the intended user role across the OAuth redirect</li>
          <li><strong>Duration:</strong> 5 minutes</li>
          <li><strong>Third-party:</strong> No</li>
        </ul>

        <h3>Sidebar state cookie</h3>
        <p>
          When you collapse or expand the dashboard sidebar, your preference is saved in a cookie so
          the sidebar remembers its position next time you visit.
        </p>
        <ul>
          <li><strong>Name:</strong> <code>sidebar_state</code></li>
          <li><strong>Purpose:</strong> UI preference, remembers sidebar open/closed state</li>
          <li><strong>Duration:</strong> 7 days</li>
          <li><strong>Third-party:</strong> No</li>
        </ul>
      </>
    ),
  },
  {
    id: "youtube-embeds",
    title: "YouTube embeds",
    body: (
      <p>
        Some lessons include YouTube video embeds. We use the <code>youtube-nocookie.com</code> domain
        for all embeds, which means YouTube does not set any tracking or advertising cookies on your
        device unless you actively click play and have a YouTube account signed in.
      </p>
    ),
  },
  {
    id: "accepting-cookies",
    title: "Do you need to accept cookies?",
    body: (
      <p>
        All three cookies are strictly necessary for the platform to function. The session cookie
        is required to stay logged in. You can block cookies in your browser settings, but doing so
        will prevent you from using the platform. Because we use no optional or tracking cookies,
        we do not display a cookie consent banner, there is nothing to opt out of.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we ever add analytics or other optional cookies in the future, we will update this page
        and add a consent mechanism before any such cookies are set.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about cookies?{" "}
        <a href="mailto:support@kindleatechie.com">support@kindleatechie.com</a>
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Cookie Policy"
      updated="July 2026"
      intro={
        <p>
          This policy lists every cookie the KAT Learning platform sets, what each one is for, and how
          long it lasts. We use only strictly necessary cookies, no advertising or tracking.
        </p>
      }
      sections={sections}
    />
  );
}
