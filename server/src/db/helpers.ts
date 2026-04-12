import { randomUUID } from "node:crypto";

export const now = () => new Date().toISOString();
export const newId = () => randomUUID();
