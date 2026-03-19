window.BCI_SCORING_CONFIG = {
  // Convex deployment URL, for example: "https://your-deployment.convex.cloud"
  convexUrl: "https://disciplined-newt-347.convex.cloud",

  // Optional override for the Convex browser module URL.
  convexModuleUrl: "https://esm.sh/convex@1.28.0/browser",

  // Convex function references (override only if you rename functions).
  functions: {
    getLeaderboard: "scoring:getLeaderboard",
    submitScorecard: "scoring:submitScorecard",
  },
};
