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

// Columns that contain encrypted data (handled by getters/setters)

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
  declare data: JsonValue; // Getter/setter handles encryption transparently
  declare meta: JsonValue | null;
  declare tokens: JsonValue | null; // Getter/setter handles encryption transparently
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
      get() {
        const raw = this.getDataValue("data" as any);
        return decryptAesGcm(raw);
      },
      set(value: JsonValue) {
        if (!value) throw new Error("Secret data cannot be empty");
        this.setDataValue("data" as any, encryptAesGcm(value));
      },
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tokens: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue("tokens" as any);
        return decryptAesGcm(raw); // Let it throw if decryption fails
      },
      set(value: JsonValue | null) {
        this.setDataValue("tokens" as any, encryptAesGcm(value));
      },
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
