export const databaseConnectionSpec = {
  provider: "postgresql",

  requiredEnv: [
    "DATABASE_URL",
    "DIRECT_URL"
  ],

  connection: {
    ssl: true,
    port: 5432,
    database: "postgres"
  },

  rules: {
    mustUseEnvVariables: true,
    noHardcodedCredentials: true,
    mustSupportCloudDatabase: true
  }
};
