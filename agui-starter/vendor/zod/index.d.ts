export type ZodIssue = { message?: string; path?: (string | number)[]; code?: string };

export declare class ZodError extends Error {
  issues: ZodIssue[];
  flatten(): { fieldErrors: Record<string, string[]>; formErrors: string[] };
}

export type SafeParseSuccess<T> = { success: true; data: T };
export type SafeParseFailure = { success: false; error: ZodError };
export type SafeParseReturnType<T> = SafeParseSuccess<T> | SafeParseFailure;

export interface ZodType<T> {
  parse(input: unknown): T;
  safeParse(input: unknown): SafeParseReturnType<T>;
  optional(): ZodType<T | undefined>;
}

export interface ZodEnum<T extends readonly [string, ...string[]]> extends ZodType<T[number]> {
  options: T;
}

export interface ZodString<T = string> extends ZodType<T> {
  min(length: number, message?: string): ZodString<T>;
  max(length: number, message?: string): ZodString<T>;
  trim(): ZodString<T>;
  refine(check: (value: T) => boolean, options?: { message?: string }): ZodString<T>;
  transform<U>(fn: (value: T) => U): ZodType<U>;
}

export interface ZodNumber extends ZodType<number> {
  min(value: number, message?: string): ZodNumber;
  max(value: number, message?: string): ZodNumber;
  int(message?: string): ZodNumber;
  positive(message?: string): ZodNumber;
}

export interface ZodBoolean extends ZodType<boolean> {}

export interface ZodUnknown extends ZodType<unknown> {}

export type ZodObjectShape = Record<string, ZodType<any>>;
export type ZodObjectType<Shape extends ZodObjectShape> = {
  [K in keyof Shape]: ReturnType<Shape[K]["parse"]>;
};

export interface ZodObject<Shape extends ZodObjectShape> extends ZodType<ZodObjectType<Shape>> {
  strict(): ZodObject<Shape>;
  superRefine(
    check: (value: ZodObjectType<Shape>, ctx: { addIssue(issue: ZodIssue): void }) => void,
  ): ZodObject<Shape>;
}

declare const ZodIssueCodeMap: { custom: "custom" };

export declare const z: {
  enum<T extends readonly [string, ...string[]]>(values: T): ZodEnum<T>;
  string(): ZodString;
  number(): ZodNumber;
  boolean(): ZodBoolean;
  unknown(): ZodUnknown;
  object<Shape extends ZodObjectShape>(shape: Shape): ZodObject<Shape>;
  ZodIssueCode: typeof ZodIssueCodeMap;
};

export declare namespace z {
  type infer<T extends ZodType<any>> = T extends ZodType<infer U> ? U : never;
  const ZodIssueCode: typeof ZodIssueCodeMap;
}

declare const exported: typeof z & {
  z: typeof z;
  ZodError: typeof ZodError;
  ZodIssueCode: typeof ZodIssueCodeMap;
};

declare const enumFn: typeof z.enum;
declare const stringFn: typeof z.string;
declare const numberFn: typeof z.number;
declare const booleanFn: typeof z.boolean;
declare const unknownFn: typeof z.unknown;
declare const objectFn: typeof z.object;

export { ZodError, ZodIssueCodeMap as ZodIssueCode };
export { z };
export { enumFn as enum };
export { stringFn as string };
export { numberFn as number };
export { booleanFn as boolean };
export { unknownFn as unknown };
export { objectFn as object };

export default exported;
