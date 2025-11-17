import { Sequelize } from "sequelize";
import config from "@/config";
import { logger } from "@/core/logger";
import { DB_CONNECTION_NAMES } from "@/shared/constants";

const postgresConnection: Partial<Record<DB_CONNECTION_NAMES, Sequelize>> = {};

export const getConnections = () => postgresConnection;

const connect = (name: DB_CONNECTION_NAMES) => {
  const sequelize = new Sequelize(config.db[name], {
    dialect: "postgres",
    logging: (msg, duration) =>
      logger.debug({
        message: msg,
        duration: typeof duration === "number" ? duration : null,
      }),
    benchmark: process.env.NODE_ENV !== "production",
    retry: {
      max: 5,
      match: [
        /ConnectionError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /SequelizeConnectionAcquireTimeoutError/,
      ],
    },
    pool: {
      max: 20,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },
    dialectOptions: {
      application_name: config.infrastructure.appName || "social-uploader",
    },
    define: {
      timestamps: false, // We'll handle timestamps manually in models
      underscored: true, // Use snake_case for database columns
    },
  });

  // Add ping method to the sequelize instance
  (sequelize as any).ping = async () => {
    try {
      await sequelize.query("SELECT 1");
      return true;
    } catch (error) {
      logger.error({ error }, "Database ping failed");
      throw error;
    }
  };

  return sequelize;
};

export async function disconnect() {
  const disconnecting = [];
  for (const name of Object.keys(postgresConnection)) {
    disconnecting.push(
      postgresConnection[name as DB_CONNECTION_NAMES]!.close()
    );
  }
  return Promise.all(disconnecting);
}

export function getDBConnection(name?: DB_CONNECTION_NAMES) {
  name ??= DB_CONNECTION_NAMES.Default;

  if (postgresConnection[name]) {
    return postgresConnection[name]!;
  }

  if (!config.db[name]) {
    throw new Error(`DB connection not exists: ${name}`);
  }

  postgresConnection[name] = connect(name);
  return postgresConnection[name]!;
}
