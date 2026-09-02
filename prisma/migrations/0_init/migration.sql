-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('CRON', 'ADMIN', 'REGISTRATION', 'MANUAL');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "leetcodeUsername" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "baselineTotalSolved" INTEGER NOT NULL DEFAULT 0,
    "baselineEasySolved" INTEGER NOT NULL DEFAULT 0,
    "baselineMediumSolved" INTEGER NOT NULL DEFAULT 0,
    "baselineHardSolved" INTEGER NOT NULL DEFAULT 0,
    "baselineCapturedAt" TIMESTAMP(3),
    "baselineLockedAt" TIMESTAMP(3),
    "challengeSolved" INTEGER NOT NULL DEFAULT 0,
    "challengeEasy" INTEGER NOT NULL DEFAULT 0,
    "challengeMedium" INTEGER NOT NULL DEFAULT 0,
    "challengeHard" INTEGER NOT NULL DEFAULT 0,
    "challengePoints" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "previousRank" INTEGER,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "syncError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeetCodeProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "realName" TEXT,
    "avatarUrl" TEXT,
    "totalSolved" INTEGER NOT NULL DEFAULT 0,
    "easySolved" INTEGER NOT NULL DEFAULT 0,
    "mediumSolved" INTEGER NOT NULL DEFAULT 0,
    "hardSolved" INTEGER NOT NULL DEFAULT 0,
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "ranking" INTEGER,
    "reputation" INTEGER,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeetCodeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSolved" INTEGER NOT NULL DEFAULT 0,
    "easySolved" INTEGER NOT NULL DEFAULT 0,
    "mediumSolved" INTEGER NOT NULL DEFAULT 0,
    "hardSolved" INTEGER NOT NULL DEFAULT 0,
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "solvedDelta" INTEGER NOT NULL DEFAULT 0,
    "easyDelta" INTEGER NOT NULL DEFAULT 0,
    "mediumDelta" INTEGER NOT NULL DEFAULT 0,
    "hardDelta" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolvedProblem" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "problemSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty",
    "solvedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionId" TEXT,

    CONSTRAINT "SolvedProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "questionId" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "ChallengeConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "challengeName" TEXT NOT NULL DEFAULT 'College LeetCode 4-Month Challenge',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "easyPoints" INTEGER NOT NULL DEFAULT 1,
    "mediumPoints" INTEGER NOT NULL DEFAULT 3,
    "hardPoints" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_leetcodeUsername_key" ON "Student"("leetcodeUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Student_usernameKey_key" ON "Student"("usernameKey");

-- CreateIndex
CREATE INDEX "Student_isActive_challengeSolved_challengePoints_idx" ON "Student"("isActive", "challengeSolved" DESC, "challengePoints" DESC);

-- CreateIndex
CREATE INDEX "Student_syncStatus_lastSyncedAt_idx" ON "Student"("syncStatus", "lastSyncedAt");

-- CreateIndex
CREATE INDEX "Student_isDemo_idx" ON "Student"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "LeetCodeProfile_studentId_key" ON "LeetCodeProfile"("studentId");

-- CreateIndex
CREATE INDEX "DailySnapshot_date_idx" ON "DailySnapshot"("date");

-- CreateIndex
CREATE INDEX "DailySnapshot_studentId_date_idx" ON "DailySnapshot"("studentId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DailySnapshot_studentId_date_key" ON "DailySnapshot"("studentId", "date");

-- CreateIndex
CREATE INDEX "SolvedProblem_studentId_solvedAt_idx" ON "SolvedProblem"("studentId", "solvedAt" DESC);

-- CreateIndex
CREATE INDEX "SolvedProblem_solvedAt_idx" ON "SolvedProblem"("solvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SolvedProblem_studentId_problemSlug_key" ON "SolvedProblem"("studentId", "problemSlug");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt" DESC);

-- AddForeignKey
ALTER TABLE "LeetCodeProfile" ADD CONSTRAINT "LeetCodeProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySnapshot" ADD CONSTRAINT "DailySnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvedProblem" ADD CONSTRAINT "SolvedProblem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

