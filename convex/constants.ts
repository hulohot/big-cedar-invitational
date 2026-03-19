export const PLAYER_DIRECTORY = {
  "ethan-brugger": "Ethan Brugger",
  "thomas-reynolds": "Thomas Reynolds",
  "cole-parton": "Cole Parton",
  "conrad-murray": "Conrad Murray",
  "justin-settlemoir": "Justin Settlemoir",
  "garrett-story": "Garrett Story",
  "dylan-huber": "Dylan Huber",
  "burke-estes": "Burke Estes",
  "tyler-estes": "Tyler Estes",
  "jimmy-carter": "Jimmy Carter",
  "rj-reynolds": "RJ Reynolds",
  "reid-estes": "Reid Estes",
} as const;

export const COURSE_DIRECTORY = {
  "buffalo-ridge": {
    name: "Buffalo Ridge",
    pars: [5, 4, 4, 3, 4, 4, 3, 5, 3, 4, 3, 4, 4, 5, 4, 4, 3, 5],
  },
  "paynes-valley": {
    name: "Payne's Valley",
    pars: [4, 3, 4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  },
  "ozarks-national": {
    name: "Ozarks National",
    pars: [5, 3, 4, 4, 4, 3, 5, 3, 5, 4, 5, 3, 4, 4, 4, 4, 3, 4],
  },
  cliffhangers: {
    name: "Cliffhangers",
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  },
} as const;

export type PlayerId = keyof typeof PLAYER_DIRECTORY;
export type CourseId = keyof typeof COURSE_DIRECTORY;

export type NormalizedScores = Record<string, number>;

export type LeaderboardEntry = {
  playerId: PlayerId;
  playerName: string;
  courseId: CourseId;
  courseName: string;
  scores: NormalizedScores;
  holesPlayed: number;
  totalStrokes: number;
  toPar: number;
  submittedAt: number;
};
