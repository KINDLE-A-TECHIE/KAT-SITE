import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, FolderOpen, Tag } from "lucide-react";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { SiteFooter } from "@/components/site-footer";

export const revalidate = 300;

type PublicProject = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  deployedUrl: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
  student: { firstName: string; lastName: string };
  program: { id: string; name: string } | null;
  files: { id: string; name: string; mimeType: string; url: string }[];
  feedback: { id: string; body: string; createdAt: string; author: { firstName: string; lastName: string; role: string } }[];
  _count: { files: number };
};

async function getProject(projectId: string): Promise<PublicProject | null> {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/projects/${projectId}/public`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { project: PublicProject };
    return data.project ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return { title: "Project Not Found. KAT Learning" };
  return {
    title: `${project.title}. KAT Learning`,
    description: project.description ?? `A project by ${project.student.firstName} ${project.student.lastName}`,
    openGraph: project.coverImageUrl ? { images: [{ url: project.coverImageUrl }] } : undefined,
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-stone-50">
      <LandingHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* Back link */}
        <Link
          href="/showcase"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
        >
          <ArrowLeft className="size-3.5" /> Back to Showcase
        </Link>

        {/* Cover image */}
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverImageUrl}
            alt={project.title}
            className="mb-8 h-64 w-full rounded-2xl object-cover shadow-sm"
          />
        ) : (
          <div className="mb-8 flex h-40 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200">
            <FolderOpen className="size-12 text-stone-300" />
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          {project.program && (
            <span className="mb-3 inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
              {project.program.name}
            </span>
          )}
          <h1 className="[font-family:var(--font-space-grotesk)] text-3xl font-bold text-stone-900 sm:text-4xl">
            {project.title}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            by {project.student.firstName} {project.student.lastName}
          </p>

          {project.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
                >
                  <Tag className="size-3" /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        {project.description && (
          <div className="mb-6 rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm leading-relaxed text-stone-700">{project.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mb-6 flex flex-wrap gap-3">
          {project.deployedUrl && (
            <a
              href={project.deployedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#B2401D] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#8F3316]"
            >
              <ExternalLink className="size-4" /> View Live Demo
            </a>
          )}
          {project.files[0] && (
            <a
              href={project.files[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
            >
              <FileText className="size-4" /> View Project File
            </a>
          )}
        </div>

        {/* Files list */}
        {project.files.length > 1 && (
          <div className="mb-6 rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Project Files</h2>
            <div className="space-y-2">
              {project.files.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 hover:underline"
                >
                  <FileText className="size-4 shrink-0 text-stone-400" />
                  {file.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Instructor feedback */}
        {project.feedback.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-stone-700">Instructor Feedback</h2>
            <div className="space-y-3">
              {project.feedback.map((fb) => (
                <div key={fb.id} className="rounded-lg bg-stone-50 p-4">
                  <p className="mb-1 text-xs font-medium text-stone-600">
                    {fb.author.firstName} {fb.author.lastName}
                  </p>
                  <p className="text-sm text-stone-700">{fb.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
