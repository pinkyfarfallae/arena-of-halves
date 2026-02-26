import { ROLE } from "../constants/role";

export type RoleName = typeof ROLE[keyof typeof ROLE];