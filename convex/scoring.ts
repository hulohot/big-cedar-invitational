import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  COURSE_DIRECTORY,
  PLAYER_DIRECTORY,
  type CourseId,
  type LeaderboardEntry,
  type NormalizedScores,
  type PlayerId,
} from "./constants";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 200;

function isPlayerId(value: string): value is PlayerId {
  return Object.prototype.hasOwnProperty.call(PLAYER_DIRECTORY, value);
}

function isCourseId(value: string): value is CourseId {
  return Object.prototype.hasOwnProperty.call(COURSE_DIRECTORY, value);
}

function normalizeScores(rawScores: Record<string, number>): NormalizedScores {
  const normalized: NormalizedScores = {};

  Object.entries(rawScores).forEach(([holeRaw, strokesRaw]) => {
    const hole = Number(holeRaw);
    const strokes = Number(strokesRaw);

    if (
      Number.isInteger(hole) &&
      hole >= 1 &&
      hole <= 18 &&
      Number.isInteger(strokes) &&
      strokes >= 1 &&
      strokes <= 15
    ) {
      normalized[String(hole)] = strokes;
    }
  });

  return normalized;
}

function deriveRoundMetrics(courseId: CourseId, scores: NormalizedScores) {
  const playedHoles = Object.keys(scores)
    .map((hole) => Number(hole))
    .sort((a, b) => a - b);

  if (playedHoles.length === 0) {
    throw new Error("At least one valid hole score is required");
  }

  let totalStrokes = 0;
  let totalPar = 0;

  playedHoles.forEach((hole) => {
    totalStrokes += scores[String(hole)];
    totalPar += COURSE_DIRECTORY[courseId].pars[hole - 1];
  });

  return {
    holesPlayed: playedHoles.length,
    totalStrokes,
    toPar: totalStrokes - totalPar,
  };
}

function buildEntry(args: {
  playerId: PlayerId;
  courseId: CourseId;
  scores: NormalizedScores;
  holesPlayed: number;
  totalStrokes: number;
  toPar: number;
  submittedAt: number;
}): LeaderboardEntry {
  return {
    playerId: args.playerId,
    playerName: PLAYER_DIRECTORY[args.playerId],
    courseId: args.courseId,
    courseName: COURSE_DIRECTORY[args.courseId].name,
    scores: args.scores,
    holesPlayed: args.holesPlayed,
    totalStrokes: args.totalStrokes,
    toPar: args.toPar,
    submittedAt: args.submittedAt,
  };
}

function leaderboardDocToEntry(doc: Doc<"leaderboardLatest">): LeaderboardEntry {
  return {
    playerId: doc.playerId as PlayerId,
    playerName: doc.playerName,
    courseId: doc.courseId as CourseId,
    courseName: doc.courseName,
    scores: doc.scores,
    holesPlayed: doc.holesPlayed,
    totalStrokes: doc.totalStrokes,
    toPar: doc.toPar,
    submittedAt: doc.submittedAt,
  };
}

function submissionDocToHistory(
  doc: Doc<"scoreSubmissions">,
  scoreId: Id<"scoreSubmissions">,
) {
  return {
    scoreId,
    playerId: doc.playerId as PlayerId,
    playerName: doc.playerName,
    courseId: doc.courseId as CourseId,
    courseName: doc.courseName,
    scores: doc.scores,
    holesPlayed: doc.holesPlayed,
    totalStrokes: doc.totalStrokes,
    toPar: doc.toPar,
    submittedAt: doc.submittedAt,
  };
}

export const submitScorecard = mutation({
  args: {
    playerId: v.string(),
    courseId: v.string(),
    scores: v.record(v.string(), v.number()),
    submittedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isPlayerId(args.playerId)) {
      throw new Error(`Unknown playerId: ${args.playerId}`);
    }
    if (!isCourseId(args.courseId)) {
      throw new Error(`Unknown courseId: ${args.courseId}`);
    }

    const normalizedScores = normalizeScores(args.scores);
    const metrics = deriveRoundMetrics(args.courseId, normalizedScores);
    const submittedAt =
      typeof args.submittedAt === "number" && Number.isFinite(args.submittedAt)
        ? Math.trunc(args.submittedAt)
        : Date.now();

    const entry = buildEntry({
      playerId: args.playerId,
      courseId: args.courseId,
      scores: normalizedScores,
      holesPlayed: metrics.holesPlayed,
      totalStrokes: metrics.totalStrokes,
      toPar: metrics.toPar,
      submittedAt,
    });

    const scoreId = await ctx.db.insert("scoreSubmissions", entry);

    const existingLatest = await ctx.db
      .query("leaderboardLatest")
      .withIndex("by_playerId", (q) => q.eq("playerId", entry.playerId))
      .unique();

    if (!existingLatest) {
      await ctx.db.insert("leaderboardLatest", {
        ...entry,
        submissionId: scoreId,
      });
    } else {
      const shouldReplace =
        entry.submittedAt > existingLatest.submittedAt ||
        entry.submittedAt === existingLatest.submittedAt;

      if (shouldReplace) {
        await ctx.db.patch(existingLatest._id, {
          ...entry,
          submissionId: scoreId,
        });
      }
    }

    return {
      scoreId,
      entry,
      savedAt: Date.now(),
    };
  },
});

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("leaderboardLatest").collect();
    const leaderboard = rows.map(leaderboardDocToEntry).sort((a, b) => {
      if (a.toPar !== b.toPar) return a.toPar - b.toPar;
      if (a.holesPlayed !== b.holesPlayed) return b.holesPlayed - a.holesPlayed;
      return a.playerName.localeCompare(b.playerName);
    });

    return {
      leaderboard,
      timestamp: Date.now(),
    };
  },
});

export const getPlayerLatestScorecard = query({
  args: {
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isPlayerId(args.playerId)) {
      throw new Error(`Unknown playerId: ${args.playerId}`);
    }

    const latest = await ctx.db
      .query("leaderboardLatest")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    return {
      entry: latest ? leaderboardDocToEntry(latest) : null,
    };
  },
});

export const getPlayerSubmissionHistory = query({
  args: {
    playerId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isPlayerId(args.playerId)) {
      throw new Error(`Unknown playerId: ${args.playerId}`);
    }

    const resolvedLimit = Math.max(
      1,
      Math.min(
        MAX_HISTORY_LIMIT,
        Math.trunc(args.limit ?? DEFAULT_HISTORY_LIMIT),
      ),
    );

    const rows = await ctx.db
      .query("scoreSubmissions")
      .withIndex("by_playerId_submittedAt", (q) =>
        q.eq("playerId", args.playerId),
      )
      .order("desc")
      .take(resolvedLimit);

    return {
      submissions: rows.map((row) => submissionDocToHistory(row, row._id)),
    };
  },
});
