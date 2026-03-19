import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  scoreSubmissions: defineTable({
    playerId: v.string(),
    playerName: v.string(),
    courseId: v.string(),
    courseName: v.string(),
    scores: v.record(v.string(), v.number()),
    holesPlayed: v.number(),
    totalStrokes: v.number(),
    toPar: v.number(),
    submittedAt: v.number(),
  })
    .index("by_playerId_submittedAt", ["playerId", "submittedAt"])
    .index("by_submittedAt", ["submittedAt"]),

  leaderboardLatest: defineTable({
    playerId: v.string(),
    playerName: v.string(),
    courseId: v.string(),
    courseName: v.string(),
    scores: v.record(v.string(), v.number()),
    holesPlayed: v.number(),
    totalStrokes: v.number(),
    toPar: v.number(),
    submittedAt: v.number(),
    submissionId: v.id("scoreSubmissions"),
  })
    .index("by_playerId", ["playerId"])
    .index("by_submittedAt", ["submittedAt"]),
});
