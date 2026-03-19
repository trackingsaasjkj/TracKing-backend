export const envSpec = {
  required: [
    "DATABASE_URL",
    "DIRECT_URL",
    "JWT_SECRET",
    "NODE_ENV"
  ],

  optional: [
    "PORT"
  ],

  rules: {
    mustExistInEnvFile: true,
    mustNotBeCommitted: true
  }
};
