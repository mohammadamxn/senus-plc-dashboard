import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (check .env.local)");
  }

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

  console.log("Running migrations against", new URL(url).host);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations complete.");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
