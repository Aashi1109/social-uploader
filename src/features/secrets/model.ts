import {
  Model,
  DataTypes,
  Optional,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  ForeignKey,
  BelongsToGetAssociationMixin,
  Association,
} from "sequelize";
import { PLATFORM_TYPES } from "@/shared/constants";
import type { JsonValue } from "@/shared/types/json";
import { getUUID } from "@/shared/utils/ids";
import { encryptAesGcm, decryptAesGcm } from "@/shared/utils/crypto";
import { Project } from "@/features/projects/model";
import { getDBConnection } from "@/shared/connections";
import { ENCRYPTED_FIELDS } from "./constants";

// Columns that contain encrypted data

// Helper: Encrypt plain objects in a single instance
const encryptFields = (instance: any, checkChanged = false): void => {
  ENCRYPTED_FIELDS.forEach((column) => {
    if (checkChanged && !instance.changed?.(column)) return;

    const value = instance[column];
    instance[column] = encryptAesGcm(value);
  });
};

// Helper: Decrypt encrypted fields in place (replaces encrypted string with decrypted object)
const decryptFields = (instance: any): void => {
  ENCRYPTED_FIELDS.forEach((column) => {
    instance[column] = decryptAesGcm(instance[column]);
  });
};

// Define attributes
export interface SecretAttributes {
  id: string;
  projectId: string | null;
  type: PLATFORM_TYPES;
  version: number;
  dataEncrypted: string;
  meta: JsonValue | null;
  tokens: string | null;
  createdAt: Date;
}

// Optional fields for creation
export interface SecretCreationAttributes
  extends Optional<
    SecretAttributes,
    "id" | "version" | "meta" | "tokens" | "createdAt"
  > {}

// Define the model class
export class Secret extends Model<
  InferAttributes<Secret>,
  InferCreationAttributes<Secret>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string> | null;
  declare type: PLATFORM_TYPES;
  declare version: CreationOptional<number>;
  declare data: JsonValue;
  declare meta: JsonValue | null;
  declare tokens: JsonValue | null;
  declare createdAt: CreationOptional<Date>;

  // Associations
  declare project?: NonAttribute<any>;
  declare getProject: BelongsToGetAssociationMixin<any>;

  declare static associations: {
    project: Association<Secret, any>;
  };
}

// Initialize the model
Secret.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => getUUID(),
    },
    projectId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "project_id",
      references: {
        model: "projects",
        key: "id",
      },
    },
    type: {
      type: DataTypes.ENUM(PLATFORM_TYPES.INSTAGRAM, PLATFORM_TYPES.YOUTUBE),
      allowNull: false,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    data: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "data",
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tokens: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    sequelize: getDBConnection(),
    tableName: "secrets",
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ["type"] }],
    hooks: {
      beforeCreate: (secret: Secret) => encryptFields(secret),
      beforeBulkCreate: (secrets: Secret[]) =>
        secrets.forEach((s) => encryptFields(s)),
      beforeUpdate: (secret: Secret) => encryptFields(secret, true),
      beforeBulkUpdate: (options: any) =>
        options.attributes && encryptFields(options.attributes),
      afterFind: (result: Secret | Secret[] | null) => {
        if (!result) return;
        const secrets = Array.isArray(result) ? result : [result];
        secrets.forEach((s) => s && decryptFields(s));
      },
    },
  }
);

Project.hasMany(Secret, {
  foreignKey: "projectId",
  as: "secrets",
  onDelete: "CASCADE",
});

// Define associations
Secret.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

(async () => {
  await Secret.sync({});
})();
