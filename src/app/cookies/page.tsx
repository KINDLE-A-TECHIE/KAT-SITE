import type { Metadata } from "next";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Cookie Policy — KAT Learning",
  description: "How KAT Learning uses cookies on its platform.",
};

export default function CookiesPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Cookie Policy"
      updated="March 2026"
    >
      <h2>What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. They allow the
        site to remember information about your visit — like whether you are logged in — so you do
        not have to repeat yourself on every page load.
      </p>

      <h2>How KAT Learning uses cookies</h2>
      <p>
        KAT Learning uses only <strong>strictly necessary cookies</strong>. We do not use advertising
        cookies, tracking cookies, or any third-party analytics tools (such as Google Analytics or
        similar). Below is a complete list of every cookie we set.
      </p>

      <h3>1. Session cookie (authentication)</h3>
      <p>
        When you sign in, NextAuth sets an encrypted, HTTP-only session cookie that keeps you logged
        in as you navigate the platform. This cookie is never accessible to JavaScript and is deleted
        when your session expires or you sign out.
      </p>
      <ul>
        <li><strong>Name:</strong> <code>next-auth.session-token</code> (or <code>__Secure-next-auth.session-token</code> on HTTPS)</li>
        <li><strong>Purpose:</strong> Authentication — identifies your active session</li>
        <li><strong>Duration:</strong> Until sign-out or session expiry</li>
        <li><strong>Third-party:</strong> No</li>
      </ul>

      <h3>2. OAuth role cookie</h3>
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

      <h3>3. Sidebar state cookie</h3>
      <p>
        When you collapse or expand the dashboard sidebar, your preference is saved in a cookie so
        the sidebar remembers its position next time you visit.
      </p>
      <ul>
        <li><strong>Name:</strong> <code>sidebar_state</code></li>
        <li><strong>Purpose:</strong> UI preference — remembers sidebar open/closed state</li>
        <li><strong>Duration:</strong> 7 days</li>
        <li><strong>Third-party:</strong> No</li>
      </ul>

      <h2>YouTube embeds</h2>
      <p>
        Some lessons include YouTube video embeds. We use the <code>youtube-nocookie.com</code> domain
        for all embeds, which means YouTube does not set any tracking or advertising cookies on your
        device unless you actively click play and have a YouTube account signed in.
      </p>

      <h2>Do you need to accept cookies?</h2>
      <p>
        All three cookies are strictly necessary for the platform to function. The session cookie
        is required to stay logged in. You can block cookies in your browser settings, but doing so
        will prevent you from using the platform. Because we use no optional or tracking cookies,
        we do not display a cookie consent banner — there is nothing to opt out of.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we ever add analytics or other optional cookies in the future, we will update this page
        and add a consent mechanism before any such cookies are set.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about cookies?{" "}
        <a href="mailto:support@kindleatechie.com">support@kindleatechie.com</a>
      </p>
    </LegalLayout>
  );
}
