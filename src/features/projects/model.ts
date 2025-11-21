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
import { Platform } from "@/features/platforms/model";
import { getDBConnection } from "@/shared/connections";

// Define attributes
export interface ProjectAttributes {
  id: string;
  slug: string;
  name: string;
  webhookUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Optional fields for creation
export interface ProjectCreationAttributes
  extends Optional<
    ProjectAttributes,
    "id" | "webhookUrl" | "createdAt" | "updatedAt"
  > {}

// Define the model class
export class Project extends Model<
  InferAttributes<Project>,
  InferCreationAttributes<Project>
> {
  declare id: CreationOptional<string>;
  declare slug: string;
  declare name: string;
  declare webhookUrl: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare platforms?: NonAttribute<any[]>;
  declare secrets?: NonAttribute<any[]>;
  declare getPlatforms: HasManyGetAssociationsMixin<any>;

  declare static associations: {
    platforms: Association<Project, any>;
    secrets: Association<Project, any>;
  };
}

// Initialize the model
Project.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal("uuidv7()"),
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    webhookUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "webhook_url",
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
    tableName: "projects",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["slug"] }],
    paranoid: true,
  }
);

(async () => {
  await Project.sync({});
})();
