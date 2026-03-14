"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ProfilePreview = {
  headline: string | null;
  bio: string | null;
  location: string | null;
  links: {
    githubUrl: string | null;
    linkedinUrl: string | null;
    twitterUrl: string | null;
    websiteUrl: string | null;
  } | null;
  skills: string[];
  education: {
    school: string;
    degree: string;
    fieldOfStudy: string | null;
    isCurrent: boolean;
  }[];
  experience: {
    company: string;
    title: string;
    isCurrent: boolean;
  }[];
};

export type ProfilePreviewContact = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  profile: ProfilePreview;
};

type ProfilePreviewCardProps = {
  contact: ProfilePreviewContact;
  compact?: boolean;
};

function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || "KP";
}

function firstPublicLink(links: ProfilePreview["links"]) {
  if (!links) {
    return null;
  }
  if (links.websiteUrl) {
    return links.websiteUrl;
  }
  if (links.linkedinUrl) {
    return links.linkedinUrl;
  }
  if (links.githubUrl) {
    return links.githubUrl;
  }
  if (links.twitterUrl) {
    return links.twitterUrl;
  }
  return null;
}

export function ProfilePreviewCard({ contact, compact = false }: ProfilePreviewCardProps) {
  const [open, setOpen] = useState(false);
  const link = firstPublicLink(contact.profile.links);
  const hasDetails =
    Boolean(contact.profile.bio) ||
    contact.profile.skills.length > 0 ||
    contact.profile.education.length > 0 ||
    contact.profile.experience.length > 0 ||
    Boolean(link);
  const avatarClasses = compact ? "size-10 border border-slate-200" : "size-12 border border-slate-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        {compact ? (
          <Avatar className={avatarClasses}>
            <AvatarImage src={contact.avatarUrl ?? undefined} alt={`${contact.firstName} ${contact.lastName}`} />
            <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
              {initials(contact.firstName, contact.lastName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <button
            type="button"
            aria-label={`View ${contact.firstName} ${contact.lastName} profile`}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => {
              if (hasDetails) {
                setOpen(true);
              }
            }}
          >
            <Avatar className={avatarClasses}>
              <AvatarImage src={contact.avatarUrl ?? undefined} alt={`${contact.firstName} ${contact.lastName}`} />
              <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                {initials(contact.firstName, contact.lastName)}
              </AvatarFallback>
            </Avatar>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {contact.firstName} {contact.lastName}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{contact.role}</p>
          {contact.profile.headline ? (
            <p className="mt-1 truncate text-xs text-slate-600">{contact.profile.headline}</p>
          ) : null}
          {contact.profile.location ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
              <MapPin className="size-3" />
              {contact.profile.location}
            </p>
          ) : null}
        </div>
      </div>

      {compact && contact.profile.skills.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {contact.profile.skills.slice(0, 2).map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      {!compact && hasDetails ? (
        <div className="mt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            View Profile
          </Button>
        </div>
      ) : null}

      {!compact ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {contact.firstName} {contact.lastName}
              </DialogTitle>
              <DialogDescription>{contact.role}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {contact.profile.headline ? <p className="text-sm text-slate-700">{contact.profile.headline}</p> : null}
              {contact.profile.bio ? <p className="text-sm text-slate-600">{contact.profile.bio}</p> : null}

              {contact.profile.skills.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {contact.profile.experience.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</p>
                  <div className="space-y-1 text-sm text-slate-600">
                    {contact.profile.experience.map((item) => (
                      <p key={`${item.company}-${item.title}`}>
                        {item.title} @ {item.company}
                        {item.isCurrent ? " (Current)" : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {contact.profile.education.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Education</p>
                  <div className="space-y-1 text-sm text-slate-600">
                    {contact.profile.education.map((item) => (
                      <p key={`${item.school}-${item.degree}`}>
                        {item.degree} - {item.school}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                >
                  View link
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
