import {
  Model,
  DataTypes,
  Optional,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  ForeignKey,
  HasManyGetAssociationsMixin,
  BelongsToGetAssociationMixin,
  Association,
  Sequelize,
} from "sequelize";
import type { JsonSchema } from "@/shared/types/json";
import { getDBConnection } from "@/shared/connections";
import { Project } from "../projects/model";

// Enums - using string literals to match database
export type TraceStatus = "running" | "success" | "partial" | "failed";
export type StepStatus = "running" | "completed" | "failed" | "skipped";

// ==================== Trace Model ====================
export interface TraceAttributes {
  id: string;
  projectId: string;
  idempotencyKey: string | null;
  status: TraceStatus;
  finalStatus: TraceStatus | null;
  totalStages: number;
  completedStages: number;
  payload: JsonSchema | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  durationMs: number | null;
}

export interface TraceCreationAttributes
  extends Optional<
    TraceAttributes,
    | "id"
    | "idempotencyKey"
    | "finalStatus"
    | "totalStages"
    | "completedStages"
    | "payload"
    | "createdAt"
    | "updatedAt"
    | "endedAt"
    | "durationMs"
  > {}

export class Trace extends Model<
  InferAttributes<Trace>,
  InferCreationAttributes<Trace>
> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare requestId: string | null;
  declare payload: JsonSchema | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare steps?: NonAttribute<Step[]>;
  declare events?: NonAttribute<Event[]>;
  declare getSteps: HasManyGetAssociationsMixin<Step>;
  declare getEvents: HasManyGetAssociationsMixin<Event>;

  declare static associations: {
    steps: Association<Trace, Step>;
    events: Association<Trace, Event>;
  };
}

Trace.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: "id",
      defaultValue: Sequelize.literal("uuidv7()"),
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "project_id",
      references: {
        model: Project,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "request_id",
    },
    payload: {
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
    tableName: "traces",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["project_id"] },
      { unique: true, fields: ["project_id", "request_id"] },
    ],
    paranoid: true,
  }
);

// ==================== Step Model ====================
export type StepKind = "master" | "platform" | "step";

export interface StepAttributes {
  id: string;
  traceId: string;
  parentStepId: string | null;
  kind: StepKind;
  name: string;
  platform: string | null;
  status: StepStatus;
  attempt: number;
  attrs: JsonSchema | null;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number | null;
  meta: JsonSchema | null;
  error: JsonSchema | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StepCreationAttributes
  extends Optional<
    StepAttributes,
    | "id"
    | "parentStepId"
    | "platform"
    | "attempt"
    | "attrs"
    | "startedAt"
    | "endedAt"
    | "durationMs"
    | "meta"
    | "error"
    | "createdAt"
    | "updatedAt"
  > {}

export class Step extends Model<
  InferAttributes<Step>,
  InferCreationAttributes<Step>
> {
  declare id: CreationOptional<string>;
  declare traceId: ForeignKey<Trace["id"]>;
  declare parentStepId: ForeignKey<Step["id"]> | null;
  declare kind: StepKind;
  declare name: string;
  declare platform: string | null;
  declare status: StepStatus;
  declare attempt: CreationOptional<number>;
  declare attrs: JsonSchema | null;
  declare startedAt: CreationOptional<Date>;
  declare endedAt: Date | null;
  declare durationMs: number | null;
  declare meta: JsonSchema | null;
  declare error: JsonSchema | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare trace?: NonAttribute<Trace>;
  declare parent?: NonAttribute<Step>;
  declare children?: NonAttribute<Step[]>;
  declare events?: NonAttribute<Event[]>;
  declare getTrace: BelongsToGetAssociationMixin<Trace>;
  declare getParent: BelongsToGetAssociationMixin<Step>;
  declare getChildren: HasManyGetAssociationsMixin<Step>;
  declare getEvents: HasManyGetAssociationsMixin<Event>;

  declare static associations: {
    trace: Association<Step, Trace>;
    parent: Association<Step, Step>;
    children: Association<Step, Step>;
    events: Association<Step, Event>;
  };
}

Step.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: "id",
      defaultValue: Sequelize.literal("uuidv7()"),
    },
    traceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "trace_id",
      references: {
        model: Trace,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    parentStepId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "parent_step_id",
      references: {
        model: Step,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    kind: {
      type: DataTypes.ENUM("master", "platform", "step"),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("running", "completed", "failed", "skipped"),
      allowNull: false,
    },
    attempt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    attrs: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "started_at",
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "ended_at",
    },
    durationMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "duration_ms",
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error: {
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
    tableName: "steps",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["parent_step_id"] }, { fields: ["trace_id"] }],
    paranoid: true,
  }
);

// ==================== Event Model ====================
export interface EventAttributes {
  id: string;
  traceId: string;
  stepId: string | null;
  name: string;
  level: string | null;
  data: JsonSchema | null;
  platform: string | null;
  step: string | null;
  status: string | null;
  durationMs: number | null;
  meta: JsonSchema | null;
  createdAt: Date;
}

export interface EventCreationAttributes
  extends Optional<
    EventAttributes,
    | "id"
    | "stepId"
    | "level"
    | "data"
    | "platform"
    | "step"
    | "status"
    | "durationMs"
    | "meta"
    | "createdAt"
  > {}

export class Event extends Model<
  InferAttributes<Event>,
  InferCreationAttributes<Event>
> {
  declare id: CreationOptional<string>;
  declare traceId: ForeignKey<Trace["id"]>;
  declare stepId: ForeignKey<Step["id"]> | null;
  declare name: string;
  declare level: string | null;
  declare data: JsonSchema | null;
  declare platform: string | null;
  declare step: string | null;
  declare status: string | null;
  declare durationMs: number | null;
  declare meta: JsonSchema | null;
  declare createdAt: CreationOptional<Date>;

  // Associations
  declare trace?: NonAttribute<Trace>;
  declare stepRel?: NonAttribute<Step>;
  declare getTrace: BelongsToGetAssociationMixin<Trace>;
  declare getStepRel: BelongsToGetAssociationMixin<Step>;

  declare static associations: {
    trace: Association<Event, Trace>;
    stepRel: Association<Event, Step>;
  };
}

Event.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: "id",
      defaultValue: Sequelize.literal("uuidv7()"),
    },
    traceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "trace_id",
      references: {
        model: Trace,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    stepId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "step_id",
      references: {
        model: Step,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    level: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    step: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    durationMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "duration_ms",
    },
    meta: {
      type: DataTypes.JSONB,
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
    tableName: "events",
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ["name"] }],
    paranoid: true,
  }
);

// ==================== Define All Associations ====================

// Trace associations
Trace.hasMany(Step, {
  foreignKey: "traceId",
  as: "steps",
  onDelete: "CASCADE",
});
Trace.hasMany(Event, {
  foreignKey: "traceId",
  as: "events",
  onDelete: "CASCADE",
});

// Step associations
Step.belongsTo(Trace, {
  foreignKey: "traceId",
  as: "trace",
});
Step.belongsTo(Step, {
  foreignKey: "parentStepId",
  as: "parent",
});
Step.hasMany(Step, {
  foreignKey: "parentStepId",
  as: "children",
  onDelete: "CASCADE",
});
Step.hasMany(Event, {
  foreignKey: "stepId",
  as: "events",
});

// Event associations
Event.belongsTo(Trace, {
  foreignKey: "traceId",
  as: "trace",
});
Event.belongsTo(Step, {
  foreignKey: "stepId",
  as: "stepRel",
});

(async () => {
  await Trace.sync({});
  await Step.sync({});
  await Event.sync({});
})();
