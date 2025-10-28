export type ZodIssue = { path?: (string | number)[]; message?: string };

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
}

export interface ZodEnum<T extends readonly [string, ...string[]]> extends ZodType<T[number]> {
  options: T;
}

export interface ZodString extends ZodType<string> {
  min(length: number, message?: string): ZodString;
}

export type ZodObjectType<Shape extends Record<string, ZodType<any>>> = {
  [K in keyof Shape]: ReturnType<Shape[K]["parse"]>;
};

export interface ZodObject<Shape extends Record<string, ZodType<any>>>
  extends ZodType<ZodObjectType<Shape>> {}

export declare const z: {
  enum<T extends readonly [string, ...string[]]>(values: T): ZodEnum<T>;
  string(): ZodString;
  object<Shape extends Record<string, ZodType<any>>>(shape: Shape): ZodObject<Shape>;
};

export declare namespace z {
  type infer<T extends ZodType<any>> = T extends ZodType<infer U> ? U : never;
}
