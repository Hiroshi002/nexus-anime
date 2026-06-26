import type { NextRequest } from "next/server";

import { route } from "@/lib/api/route";
import { requireAuthOrThrow } from "@/lib/api/auth-guard";
import { validate } from "@/lib/api/validate";
import {
  createUserSchema,
  updateUserSchema,
  queryUsersSchema,
} from "../dto";
import { userService } from "../service";

/**
 * User controller — thin HTTP layer that:
 * 1. Validates incoming data via Zod schemas
 * 2. Delegates to the service layer
 * 3. Returns domain-shaped data (envelope applied by `route()` wrapper)
 *
 * Authentication is enforced per-handler via `requireAuth()`. The middleware
 * already redirects unauthenticated browsers at the route-group level; this
 * guards direct API calls (which don't redirect — they 401).
 */
export const userController = {
  create: route(async (req: NextRequest) => {
    await requireAuthOrThrow();
    const body = await req.json();
    const dto = validate(createUserSchema, body);
    return userService.create(dto);
  }),

  findById: route(async (_req: NextRequest, { params }) => {
    await requireAuthOrThrow();
    const { id } = await params;
    return userService.findById(id!);
  }),

  query: route(async (req: NextRequest) => {
    await requireAuthOrThrow();
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit"));
    const offsetParam = Number(url.searchParams.get("offset"));
    const searchParam = url.searchParams.get("search");
    const dto = validate(queryUsersSchema, {
      search: searchParam || undefined,
      limit: Number.isFinite(limitParam) ? limitParam : 20,
      offset: Number.isFinite(offsetParam) ? offsetParam : 0,
    });
    return userService.query(dto);
  }),

  update: route(async (req: NextRequest, { params }) => {
    await requireAuthOrThrow();
    const { id } = await params;
    const body = await req.json();
    const dto = validate(updateUserSchema, body);
    return userService.update(id!, dto);
  }),

  delete: route(async (_req: NextRequest, { params }) => {
    await requireAuthOrThrow();
    const { id } = await params;
    await userService.delete(id!);
    return { deleted: true };
  }),
} as const;
