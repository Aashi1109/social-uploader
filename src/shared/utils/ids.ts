import crypto from "node:crypto";
import { v7 as uuidv7 } from "uuid";

export const getUUID = () => crypto.randomUUID();

export const getUUIDv7 = () => uuidv7();
