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
import { getDBConnection } from "@/shared/connections";

// Define attributes
export interface PlatformAttributes {
  id: string;
  projectId: string;
  name: PLATFORM_TYPES;
  enabled: boolean;
  config: JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

// Optional fields for creation
export interface PlatformCreationAttributes
  extends Optional<
    PlatformAttributes,
    "id" | "enabled" | "config" | "createdAt" | "updatedAt"
  > {}

// Define the model class
export class Platform extends Model<
  InferAttributes<Platform>,
  InferCreationAttributes<Platform>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare name: PLATFORM_TYPES;
  declare enabled: CreationOptional<boolean>;
  declare type: PLATFORM_TYPES;
  declare config: JsonValue | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare project?: NonAttribute<any>;
  declare getProject: BelongsToGetAssociationMixin<any>;

  declare static associations: {
    project: Association<Platform, any>;
  };
}

// Initialize the model
Platform.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => getUUID(),
    },
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "project_id",
      references: {
        model: "projects",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(PLATFORM_TYPES)),
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    sequelize: getDBConnection(),
    tableName: "platforms",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["project_id"] },
      { unique: true, fields: ["project_id", "type"] },
    ],
  }
);

(async () => {
  await Platform.sync({});
})();
