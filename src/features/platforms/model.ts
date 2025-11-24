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
  Sequelize,
} from "sequelize";
import { PLATFORM_TYPES } from "@/shared/constants";
import { getDBConnection } from "@/shared/connections";
import { Project } from "../projects/model";
import { Secret } from "../secrets/model";
import { JsonSchema } from "@/shared/types/json";

// Define attributes
export interface PlatformAttributes {
  id: string;
  projectId: string;
  name: string;
  type: PLATFORM_TYPES;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Optional fields for creation
export interface PlatformCreationAttributes
  extends Optional<
    PlatformAttributes,
    "id" | "enabled" | "createdAt" | "updatedAt"
  > {}

// Define the model class
export class Platform extends Model<
  InferAttributes<Platform>,
  InferCreationAttributes<Platform>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<string>;
  declare name: string;
  declare enabled: CreationOptional<boolean>;
  declare type: PLATFORM_TYPES;
  declare secretId: ForeignKey<string>;
  declare config: JsonSchema;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare project?: NonAttribute<Project>;
  declare getProject: BelongsToGetAssociationMixin<Project>;

  declare secret?: NonAttribute<Secret>;
  declare getSecret: BelongsToGetAssociationMixin<Secret>;

  declare static associations: {
    project: Association<Platform, Project>;
    secret: Association<Platform, Secret>;
  };
}

// Initialize the model
Platform.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal("uuidv7()"),
    },
    projectId: {
      type: DataTypes.UUID,
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
      type: DataTypes.ENUM({
        values: Object.values(PLATFORM_TYPES),
      }),
      allowNull: false,
    },
    secretId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "secret_id",
      references: {
        model: Secret,
        key: "id",
      },
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false,
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
    paranoid: true,
  }
);

(async () => {
  await Platform.sync({});
})();

Project.hasMany(Platform, {
  foreignKey: "projectId",
  as: "platforms",
  onDelete: "CASCADE",
});

Platform.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

Platform.belongsTo(Secret, {
  foreignKey: "secretId",
  as: "secret",
});

Secret.hasMany(Platform, {
  foreignKey: "secretId",
  as: "platforms",
  onDelete: "RESTRICT",
});
