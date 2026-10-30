import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

function getDbUrl(): string {
  const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE } = process.env;
  if (DB_HOST && DB_USERNAME && DB_PASSWORD && DB_DATABASE) {
    const cleanPass = DB_PASSWORD.replace(/^['"]|['"]$/g, '');
    const encodedPass = encodeURIComponent(cleanPass);
    return `postgresql://${DB_USERNAME}:${encodedPass}@${DB_HOST}:${DB_PORT || 5432}/${DB_DATABASE}?schema=public`;
  }
  return env('DATABASE_URL');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: getDbUrl(),
  },
});
