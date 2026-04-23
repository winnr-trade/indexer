import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './common/drizzle',
  schema: './common/src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:admin123@localhost:5432/postgres',
  },
});
