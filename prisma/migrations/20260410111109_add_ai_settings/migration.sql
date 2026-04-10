-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "dateFormat" TEXT NOT NULL DEFAULT 'EU',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "transactionsDateFrom" TEXT,
    "transactionsDateTo" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiCategoriesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiSubscriptionDetection" BOOLEAN NOT NULL DEFAULT false,
    "aiEndpoint" TEXT,
    "aiModel" TEXT,
    "aiApiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "currency", "dateFormat", "email", "id", "name", "theme", "transactionsDateFrom", "transactionsDateTo") SELECT "createdAt", "currency", "dateFormat", "email", "id", "name", "theme", "transactionsDateFrom", "transactionsDateTo" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
