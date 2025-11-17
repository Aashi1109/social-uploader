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
} from "sequelize";
import type { JsonValue } from "@/shared/types/json";
import { getUUID } from "@/shared/utils/ids";
import { getDBConnection } from "@/shared/connections";

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
  payload: JsonValue | null;
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
  declare idempotencyKey: string | null;
  declare status: TraceStatus;
  declare finalStatus: TraceStatus | null;
  declare totalStages: CreationOptional<number>;
  declare completedStages: CreationOptional<number>;
  declare payload: JsonValue | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare endedAt: Date | null;
  declare durationMs: number | null;

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
      type: DataTypes.STRING,
      primaryKey: true,
      field: "trace_id",
      defaultValue: () => getUUID(),
    },
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "project_id",
    },
    idempotencyKey: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "idempotency_key",
    },
    status: {
      type: DataTypes.ENUM("running", "success", "partial", "failed"),
      allowNull: false,
    },
    finalStatus: {
      type: DataTypes.ENUM("running", "success", "partial", "failed"),
      allowNull: true,
      field: "final_status",
    },
    totalStages: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "total_stages",
    },
    completedStages: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "completed_stages",
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
  },
  {
    sequelize: getDBConnection(),
    tableName: "traces",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["project_id"] },
      { unique: true, fields: ["project_id", "idempotency_key"] },
    ],
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
  attrs: JsonValue | null;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number | null;
  error: JsonValue | null;
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
  declare attrs: JsonValue | null;
  declare startedAt: CreationOptional<Date>;
  declare endedAt: Date | null;
  declare durationMs: number | null;
  declare error: JsonValue | null;
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
      type: DataTypes.STRING,
      primaryKey: true,
      field: "stage_id",
      defaultValue: () => getUUID(),
    },
    traceId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "trace_id",
      references: {
        model: "traces",
        key: "trace_id",
      },
      onDelete: "CASCADE",
    },
    parentStageId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "parent_stage_id",
      references: {
        model: "stages",
        key: "stage_id",
      },
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
    indexes: [{ fields: ["trace_id"] }],
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
  meta: JsonValue | null;
  error: JsonValue | null;
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
  declare meta: JsonValue | null;
  declare error: JsonValue | null;
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
      type: DataTypes.STRING,
      primaryKey: true,
      field: "step_id",
      defaultValue: () => getUUID(),
    },
    traceId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "trace_id",
      references: {
        model: "traces",
        key: "trace_id",
      },
      onDelete: "CASCADE",
    },
    stageId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "stage_id",
      references: {
        model: "stages",
        key: "stage_id",
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
  }
);

// ==================== Event Model ====================
export interface EventAttributes {
  id: string;
  traceId: string;
  stageId: string | null;
  stepId: string | null;
  timestamp: Date;
  name: string;
  level: string | null;
  data: JsonValue | null;
  platform: string | null;
  step: string | null;
  status: string | null;
  durationMs: number | null;
  meta: JsonValue | null;
  createdAt: Date;
}

export interface EventCreationAttributes
  extends Optional<
    EventAttributes,
    | "id"
    | "stageId"
    | "stepId"
    | "timestamp"
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
  declare timestamp: CreationOptional<Date>;
  declare name: string;
  declare level: string | null;
  declare data: JsonValue | null;
  declare platform: string | null;
  declare step: string | null;
  declare status: string | null;
  declare durationMs: number | null;
  declare meta: JsonValue | null;
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
      type: DataTypes.STRING,
      primaryKey: true,
      field: "event_id",
      defaultValue: () => getUUID(),
    },
    traceId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "trace_id",
      references: {
        model: "traces",
        key: "trace_id",
      },
      onDelete: "CASCADE",
    },
    stageId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "stage_id",
      references: {
        model: "stages",
        key: "stage_id",
      },
    },
    stepId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "step_id",
      references: {
        model: "steps",
        key: "step_id",
      },
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
    indexes: [
      { fields: ["trace_id", "timestamp"] },
      { fields: ["stage_id", "timestamp"] },
      { fields: ["name"] },
    ],
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
