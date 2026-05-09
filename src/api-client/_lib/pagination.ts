import { z } from "zod";

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export function cursorPageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** Renamed for the call site — pairs with `cursorPageSchema` so all cursor knobs travel under one import. */
export { keepPreviousData as cursorPlaceholderData } from "@tanstack/react-query";
