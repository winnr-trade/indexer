import winston from "winston";

export function createLogger(env: string) {
  const isTest = env === "test";
  const level = env !== "production" ? "debug" : "info";

  return winston.createLogger({
    silent: isTest,
    level,
    format: winston.format.json(),
    transports: [
      // improve this config later
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ],
  });
}

export type Logger = winston.Logger;
