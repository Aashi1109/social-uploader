import {
  Model,
  DataTypes,
  Optional,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Sequelize,
} from "sequelize";
import { PLATFORM_TYPES } from "@/shared/constants";
import type { JsonValue } from "@/shared/types/json";
import { encryptAesGcm, decryptAesGcm } from "@/shared/utils/crypto";
import { getDBConnection } from "@/shared/connections";

// Define attributes
export interface SecretAttributes {
  id: string;
  platformIds: string[] | null;
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
    "id" | "version" | "meta" | "tokens" | "createdAt" | "platformIds"
  > {}

// Define the model class
export class Secret extends Model<
  InferAttributes<Secret>,
  InferCreationAttributes<Secret>
> {
  declare id: CreationOptional<string>;
  declare platformIds: string[] | null;
  declare type: PLATFORM_TYPES;
  declare version: CreationOptional<number>;
  declare data: JsonValue; // Getter/setter handles encryption transparently
  declare meta: JsonValue | null;
  declare tokens: JsonValue | null; // Getter/setter handles encryption transparently
  declare createdAt: CreationOptional<Date>;

  // Note: Since platformIds is an array, we can't use standard Sequelize associations
  // Platforms must be loaded manually using WHERE id IN (platformIds)
}

// Initialize the model
Secret.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal("uuidv7()"),
    },
    platformIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      field: "platform_ids",
      // Note: Sequelize doesn't support FK constraints on array columns
      // Referential integrity must be maintained at application level or via DB triggers
    },
    type: {
      type: DataTypes.ENUM({
        values: Object.values(PLATFORM_TYPES),
      }),
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
    paranoid: true,
  }
);

(async () => {
  await Secret.sync({});
})();
