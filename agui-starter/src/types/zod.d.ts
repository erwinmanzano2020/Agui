/* eslint-disable @typescript-eslint/no-explicit-any -- Minimal Zod typing shim for tests when real package is unavailable. */
declare module "zod" {
  export type ZodIssue = {
    message?: string;
    code?: string;
    [key: string]: unknown;
  };

  export type ZodParseSuccess<T> = { success: true; data: T };
  export type ZodParseFailure = {
    success: false;
    error: {
      issues: ZodIssue[];
      errors: ZodIssue[];
      flatten: () => { formErrors: string[] };
    };
  };

  export type ZodTypeAny = {
    safeParse: (input: unknown) => ZodParseSuccess<any> | ZodParseFailure;
    parse: (input: unknown) => any;
    optional: () => ZodTypeAny;
    default: (value: unknown) => ZodTypeAny;
    array: () => ZodTypeAny;
    int: () => ZodTypeAny;
    positive: () => ZodTypeAny;
    max: (value: number) => ZodTypeAny;
    superRefine: (
      refinement: (value: any, ctx: { addIssue: (issue: ZodIssue) => void }) => void
    ) => ZodTypeAny;
  } & Record<string, unknown>;

  export type AnyZodObject = ZodTypeAny & {
    shape?: Record<string, ZodTypeAny>;
    strict: () => AnyZodObject;
  };

  export type ZodEnum<T extends readonly [string, ...string[]]> = ZodTypeAny & {
    options: T;
    Enum: { [Value in T[number]]: Value };
  };

  type StringSchema = ZodTypeAny & {
    min: (value: number, message?: string) => StringSchema;
    max: (value: number, message?: string) => StringSchema;
    regex: (pattern: RegExp, message?: string) => StringSchema;
    trim: () => StringSchema;
    uuid: () => StringSchema;
    optional: () => StringSchema;
  };

  export const z: {
    enum: <T extends readonly [string, ...string[]]>(
      values: T,
      options?: { errorMap?: (issue: { code?: string }) => { message: string } }
    ) => ZodEnum<T>;
    string: () => StringSchema;
    number: () => ZodTypeAny;
    boolean: () => ZodTypeAny;
    unknown: () => ZodTypeAny;
    any: () => ZodTypeAny;
    record: (key?: ZodTypeAny, value?: ZodTypeAny) => ZodTypeAny;
    object: <Shape extends Record<string, ZodTypeAny>>(shape: Shape) => AnyZodObject;
    optional: <Schema extends ZodTypeAny>(schema: Schema) => Schema;
    ZodIssueCode: { custom: "custom"; invalid_enum_value: "invalid_enum_value" };
  };

  export default z;
}
