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
export type StageKind = "master" | "platform";
export type StageStatus = "running" | "completed" | "failed";
export type StepName = "prep" | "upload" | "publish";
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
  declare stages?: NonAttribute<Stage[]>;
  declare steps?: NonAttribute<Step[]>;
  declare events?: NonAttribute<Event[]>;
  declare getStages: HasManyGetAssociationsMixin<Stage>;
  declare getSteps: HasManyGetAssociationsMixin<Step>;
  declare getEvents: HasManyGetAssociationsMixin<Event>;

  declare static associations: {
    stages: Association<Trace, Stage>;
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

// ==================== Stage Model ====================
export interface StageAttributes {
  id: string;
  traceId: string;
  parentStageId: string | null;
  kind: StageKind;
  name: string;
  status: StageStatus;
  progressCompleted: number;
  progressTotal: number;
  attempt: number;
  attrs: JsonSchema | null;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number | null;
  error: JsonSchema | null;
  platform: string | null;
  order: number;
}

export interface StageCreationAttributes
  extends Optional<
    StageAttributes,
    | "id"
    | "parentStageId"
    | "progressCompleted"
    | "progressTotal"
    | "attempt"
    | "attrs"
    | "startedAt"
    | "endedAt"
    | "durationMs"
    | "error"
    | "platform"
    | "order"
  > {}

export class Stage extends Model<
  InferAttributes<Stage>,
  InferCreationAttributes<Stage>
> {
  declare id: CreationOptional<string>;
  declare traceId: ForeignKey<Trace["id"]>;
  declare parentStageId: ForeignKey<Stage["id"]> | null;
  declare kind: StageKind;
  declare name: string;
  declare status: StageStatus;
  declare progressCompleted: CreationOptional<number>;
  declare progressTotal: CreationOptional<number>;
  declare attempt: CreationOptional<number>;
  declare attrs: JsonSchema | null;
  declare startedAt: CreationOptional<Date>;
  declare endedAt: Date | null;
  declare durationMs: number | null;
  declare error: JsonSchema | null;
  declare platform: string | null;
  declare order: CreationOptional<number>;

  // Associations
  declare trace?: NonAttribute<Trace>;
  declare parent?: NonAttribute<Stage>;
  declare children?: NonAttribute<Stage[]>;
  declare steps?: NonAttribute<Step[]>;
  declare events?: NonAttribute<Event[]>;
  declare getTrace: BelongsToGetAssociationMixin<Trace>;
  declare getParent: BelongsToGetAssociationMixin<Stage>;
  declare getChildren: HasManyGetAssociationsMixin<Stage>;
  declare getSteps: HasManyGetAssociationsMixin<Step>;
  declare getEvents: HasManyGetAssociationsMixin<Event>;

  declare static associations: {
    trace: Association<Stage, Trace>;
    parent: Association<Stage, Stage>;
    children: Association<Stage, Stage>;
    steps: Association<Stage, Step>;
    events: Association<Stage, Event>;
  };
}

Stage.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: "stage_id",
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
    parentStageId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "parent_stage_id",
      references: {
        model: Stage,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    kind: {
      type: DataTypes.ENUM("master", "platform"),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("running", "completed", "failed"),
      allowNull: false,
    },
    progressCompleted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "progress_completed",
    },
    progressTotal: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "progress_total",
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
    error: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize: getDBConnection(),
    tableName: "stages",
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ["id"] }],
    paranoid: true,
  }
);

// ==================== Step Model ====================
export interface StepAttributes {
  id: string;
  traceId: string;
  stageId: string;
  name: StepName;
  status: StepStatus;
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
  declare stageId: ForeignKey<Stage["id"]>;
  declare name: StepName;
  declare status: StepStatus;
  declare startedAt: CreationOptional<Date>;
  declare endedAt: Date | null;
  declare durationMs: number | null;
  declare meta: JsonSchema | null;
  declare error: JsonSchema | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare trace?: NonAttribute<Trace>;
  declare stage?: NonAttribute<Stage>;
  declare events?: NonAttribute<Event[]>;
  declare getTrace: BelongsToGetAssociationMixin<Trace>;
  declare getStage: BelongsToGetAssociationMixin<Stage>;
  declare getEvents: HasManyGetAssociationsMixin<Event>;

  declare static associations: {
    trace: Association<Step, Trace>;
    stage: Association<Step, Stage>;
    events: Association<Step, Event>;
  };
}

Step.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: "step_id",
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
    stageId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "stage_id",
      references: {
        model: Stage,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    name: {
      type: DataTypes.ENUM("prep", "upload", "publish"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("running", "completed", "failed", "skipped"),
      allowNull: false,
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
    indexes: [{ fields: ["stage_id"] }, { fields: ["trace_id"] }],
    paranoid: true,
  }
);

// ==================== Event Model ====================
export interface EventAttributes {
  id: string;
  traceId: string;
  stageId: string | null;
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
    | "stageId"
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
  declare stageId: ForeignKey<Stage["id"]> | null;
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
  declare stage?: NonAttribute<Stage>;
  declare stepRel?: NonAttribute<Step>;
  declare getTrace: BelongsToGetAssociationMixin<Trace>;
  declare getStage: BelongsToGetAssociationMixin<Stage>;
  declare getStepRel: BelongsToGetAssociationMixin<Step>;

  declare static associations: {
    trace: Association<Event, Trace>;
    stage: Association<Event, Stage>;
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
    stageId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "stage_id",
      references: {
        model: Stage,
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
Trace.hasMany(Stage, {
  foreignKey: "traceId",
  as: "stages",
  onDelete: "CASCADE",
});
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

// Stage associations
Stage.belongsTo(Trace, {
  foreignKey: "traceId",
  as: "trace",
});
Stage.belongsTo(Stage, {
  foreignKey: "parentStageId",
  as: "parent",
});
Stage.hasMany(Stage, {
  foreignKey: "parentStageId",
  as: "children",
});
Stage.hasMany(Step, {
  foreignKey: "stageId",
  as: "steps",
  onDelete: "CASCADE",
});
Stage.hasMany(Event, {
  foreignKey: "stageId",
  as: "events",
});

// Step associations
Step.belongsTo(Trace, {
  foreignKey: "traceId",
  as: "trace",
});
Step.belongsTo(Stage, {
  foreignKey: "stageId",
  as: "stage",
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
Event.belongsTo(Stage, {
  foreignKey: "stageId",
  as: "stage",
});
Event.belongsTo(Step, {
  foreignKey: "stepId",
  as: "stepRel",
});

(async () => {
  await Trace.sync({});
  await Stage.sync({});
  await Step.sync({});
  await Event.sync({});
})();
