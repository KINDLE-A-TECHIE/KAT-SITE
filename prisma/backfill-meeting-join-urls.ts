import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const APPLY_MODE = process.argv.includes("--apply");
const INCLUDE_PATH_MISMATCH = process.argv.includes("--include-path-mismatch");
const limitFlag = process.argv.find((arg) => arg.startsWith("--limit="));
const limitValue = limitFlag ? Number(limitFlag.split("=")[1]) : null;
const limit = Number.isFinite(limitValue) && (limitValue ?? 0) > 0 ? Number(limitValue) : null;
const joinBaseUrl = (process.env.ZOHO_MEETING_JOIN_BASE_URL ?? "https://meet.zoho.com").replace(/\/$/, "");

type Candidate = {
  id: string;
  title: string;
  currentUrl: string;
  targetUrl: string;
  reason: string;
};

function isAutoFixReason(reason: string) {
  return (
    reason === "invalid_url" ||
    reason === "meeting_host_url" ||
    reason === "tokenized_or_query_url" ||
    reason === "unexpected_host"
  );
}

function isSafeMeetingKey(value: string | null | undefined) {
  const key = value?.trim() ?? "";
  if (!key) {
    return null;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(key)) {
    return null;
  }
  return key;
}

function buildTargetUrl(meetingKey: string) {
  return `${joinBaseUrl}/${encodeURIComponent(meetingKey)}`;
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function lastPathSegment(url: URL) {
  const segment = url.pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function classifyBackfillReason(currentUrl: string, meetingKey: string, targetUrl: string) {
  const parsed = safeParseUrl(currentUrl);
  if (!parsed) {
    return "invalid_url";
  }

  const host = parsed.hostname.toLowerCase();
  const hasSearchOrHash = parsed.search.length > 0 || parsed.hash.length > 0;
  const segment = lastPathSegment(parsed);
  const isMeetHost = /(^|\.)meet\.zoho\./.test(host);
  const isMeetingHost = /(^|\.)meeting\.zoho\./.test(host);
  const isExactDirectJoin = currentUrl === targetUrl;
  const pathMatchesKey = segment === meetingKey;

  if (isExactDirectJoin && isMeetHost && pathMatchesKey && !hasSearchOrHash) {
    return null;
  }

  if (isMeetingHost) {
    return "meeting_host_url";
  }
  if (hasSearchOrHash) {
    return "tokenized_or_query_url";
  }
  if (!isMeetHost) {
    return "unexpected_host";
  }
  if (!pathMatchesKey) {
    return "path_key_mismatch";
  }

  return null;
}

async function main() {
  const meetings = await prisma.meeting.findMany({
    select: {
      id: true,
      title: true,
      dailyRoomName: true,
      dailyRoomUrl: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const candidates: Candidate[] = [];
  const skippedPathMismatch = [];
  let skippedNoKey = 0;
  let skippedNoUrl = 0;

  for (const meeting of meetings) {
    const meetingKey = isSafeMeetingKey(meeting.dailyRoomName);
    if (!meetingKey) {
      skippedNoKey += 1;
      continue;
    }

    const currentUrl = (meeting.dailyRoomUrl ?? "").trim();
    if (!currentUrl) {
      skippedNoUrl += 1;
      continue;
    }

    const targetUrl = buildTargetUrl(meetingKey);
    const reason = classifyBackfillReason(currentUrl, meetingKey, targetUrl);
    if (!reason) {
      continue;
    }

    if (reason === "path_key_mismatch" && !INCLUDE_PATH_MISMATCH) {
      skippedPathMismatch.push(meeting.id);
      continue;
    }

    candidates.push({
      id: meeting.id,
      title: meeting.title,
      currentUrl,
      targetUrl,
      reason,
    });
  }

  const actionable = limit ? candidates.slice(0, limit) : candidates;

  console.log(`Zoho meeting join URL backfill (${APPLY_MODE ? "apply" : "dry-run"})`);
  console.log(`Total meetings: ${meetings.length}`);
  console.log(`Candidates: ${candidates.length}${limit ? ` (limited to ${actionable.length})` : ""}`);
  console.log(`Skipped (invalid/missing meeting key): ${skippedNoKey}`);
  console.log(`Skipped (missing current URL): ${skippedNoUrl}`);
  if (!INCLUDE_PATH_MISMATCH) {
    console.log(`Skipped (path mismatch; requires --include-path-mismatch): ${skippedPathMismatch.length}`);
  }

  if (actionable.length > 0) {
    console.table(
      actionable.slice(0, 20).map((item) => ({
        id: item.id,
        reason: item.reason,
        title: item.title.slice(0, 48),
        from: item.currentUrl.slice(0, 72),
        to: item.targetUrl,
      })),
    );
  }

  if (!APPLY_MODE) {
    console.log("Dry-run only. Re-run with --apply to write updates.");
    return;
  }

  let updated = 0;
  for (const item of actionable) {
    if (!isAutoFixReason(item.reason) && !INCLUDE_PATH_MISMATCH) {
      continue;
    }
    await prisma.meeting.update({
      where: { id: item.id },
      data: { dailyRoomUrl: item.targetUrl },
    });
    updated += 1;
  }

  console.log(`Updated ${updated} meeting URL(s).`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
