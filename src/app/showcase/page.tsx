import Link from "next/link";
import { ExternalLink, FileText, FolderOpen } from "lucide-react";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { SiteFooter } from "@/components/site-footer";

export const revalidate = 300;

type ShowcaseProject = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  deployedUrl: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
  student: { firstName: string; lastName: string };
  program: { name: string } | null;
  files: { id: string; name: string; mimeType: string; url: string }[];
  _count: { files: number };
};

async function getShowcaseProjects(): Promise<ShowcaseProject[]> {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/projects/showcase`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { projects: ShowcaseProject[] };
    return data.projects ?? [];
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Project Showcase — KAT Learning",
  description: "Explore projects built by KAT Learning students and fellows.",
};

export default async function ShowcasePage() {
  const projects = await getShowcaseProjects();

  return (
    <div className="min-h-screen bg-slate-50">
      <LandingHeader />

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
            <FolderOpen className="size-4" />
            Student Projects
          </div>
          <h1 className="[font-family:var(--font-space-grotesk)] text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            What our learners build
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Real projects created by KAT Learning students and fellows — from web apps to games, data tools and more.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100">
              <FolderOpen className="size-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-600">No public projects yet</p>
            <p className="mt-1 text-sm text-slate-400">Check back soon — our learners are building!</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                {/* Cover image */}
                {project.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.coverImageUrl}
                    alt={project.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                    <FolderOpen className="size-10 text-slate-300" />
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5">
                  {/* Program badge */}
                  {project.program && (
                    <span className="mb-2 inline-block self-start rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {project.program.name}
                    </span>
                  )}

                  <h2 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-900 leading-snug">
                    {project.title}
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    by {project.student.firstName} {project.student.lastName}
                  </p>

                  {project.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-slate-600 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Tags */}
                  {project.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {project.tags.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Footer actions */}
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                    {project._count.files > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <FileText className="size-3.5" />
                        {project._count.files} file{project._count.files !== 1 ? "s" : ""}
                      </span>
                    )}
                    <div className="flex-1" />
                    {project.deployedUrl && (
                      <a
                        href={project.deployedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <ExternalLink className="size-3.5" />
                        Live demo
                      </a>
                    )}
                    {project.files[0] && (
                      <a
                        href={project.files[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-[#1E5FAF] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#1a52a0]"
                      >
                        View Project
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
