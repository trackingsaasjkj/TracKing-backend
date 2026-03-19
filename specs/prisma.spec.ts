export const prismaSpec = {
  datasource: {
    provider: "postgresql",
    url: "env(DATABASE_URL)",
    directUrl: "env(DIRECT_URL)"
  },

  generator: {
    provider: "prisma-client-js"
  },

  rules: {
    mustMatchDatabaseSchema: true,
    mustUseMigrations: true,
    mustGenerateClient: true
  }
};
