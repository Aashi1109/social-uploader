import {
  Model,
  DataTypes,
  Optional,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  HasManyGetAssociationsMixin,
  Association,
  Sequelize,
} from "sequelize";
import { PLATFORM_TYPES } from "@/shared/constants";
import type { JsonSchema } from "@/shared/types/json";
import { encryptAesGcm, decryptAesGcm } from "@/shared/utils/crypto";
import { getDBConnection } from "@/shared/connections";

// Define attributes
export interface SecretAttributes {
  id: string;
  platformIds: string[] | null;
  type: PLATFORM_TYPES;
  version: number;
  data: JsonSchema;
  meta: JsonSchema | null;
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
  declare type: PLATFORM_TYPES;
  declare version: CreationOptional<number>;
  declare data: JsonSchema; // Getter returns decrypted JsonSchema
  declare meta: JsonSchema | null;
  declare tokens: JsonSchema; // Getter returns decrypted JsonSchema
  declare createdAt: CreationOptional<Date>;

  // Associations
  declare platforms?: NonAttribute<any[]>;
  declare getPlatforms: HasManyGetAssociationsMixin<any>;

  declare static associations: {
    platforms: Association<Secret, any>;
  };
}

// Initialize the model
Secret.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal("uuidv7()"),
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
      set(value: JsonSchema) {
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
      set(value: JsonSchema | null) {
        this.setDataValue("tokens" as any, encryptAesGcm(value!));
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

// Note: Secret.hasMany(Platform) association is defined in Platform model
// to avoid circular dependency issues
