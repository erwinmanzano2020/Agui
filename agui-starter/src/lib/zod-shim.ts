export type ZodIssue = { message?: string };

export type ZodParseSuccess<T> = { success: true; data: T };
export type ZodParseFailure = {
  success: false;
  error: {
    issues: ZodIssue[];
    errors: ZodIssue[];
    flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[]> };
  };
};

export type ZodParseResult<T> = ZodParseSuccess<T> | ZodParseFailure;

export type ZodSchema<T> = {
  safeParse: (value: unknown) => ZodParseResult<T>;
  parse: (value: unknown) => T;
  optional: () => ZodSchema<T | undefined>;
  nullable: () => ZodSchema<T | null>;
  default: (value: T) => ZodSchema<T>;
  array: () => ZodSchema<T[]>;
  superRefine: (refinement: (value: T, ctx: { addIssue: (issue: ZodIssue) => void }) => void) => ZodSchema<T>;
};

const ISSUE_CODES = { custom: "custom", invalid_enum_value: "invalid_enum_value" } as const;

function success<T>(data: T): ZodParseSuccess<T> {
  return { success: true, data };
}

function failure(message: string): ZodParseFailure {
  const issue = { message };
  return {
    success: false,
    error: {
      issues: [issue],
      errors: [issue],
      flatten: () => ({ formErrors: [message], fieldErrors: {} }),
    },
  };
}

function mergeFailure<T>(result: ZodParseResult<T>, fallbackMessage: string): ZodParseFailure {
  if (result.success) return failure(fallbackMessage);
  const issueMessage = result.error.issues[0]?.message ?? fallbackMessage;
  return failure(issueMessage);
}

function createSchema<T>(validator: (value: unknown) => ZodParseResult<T>): ZodSchema<T> {
  return {
    safeParse: validator,
    parse(value: unknown) {
      const result = validator(value);
      if (!result.success) {
        throw new Error(result.error.issues[0]?.message ?? "Invalid value");
      }
      return result.data;
    },
    optional(): ZodSchema<T | undefined> {
      return createSchema<T | undefined>((value) => {
        if (value === undefined) {
          return success(undefined);
        }
        const result = validator(value);
        return result.success ? success(result.data as T | undefined) : result;
      });
    },
    nullable(): ZodSchema<T | null> {
      return createSchema<T | null>((value) => {
        if (value === null) {
          return success(null);
        }
        const result = validator(value);
        return result.success ? success(result.data as T | null) : result;
      });
    },
    default(defaultValue: T) {
      return createSchema((value) => (value === undefined ? success(defaultValue) : validator(value)));
    },
    array(): ZodSchema<T[]> {
      return createSchema<T[]>((value) => {
        if (!Array.isArray(value)) {
          return failure("Invalid array");
        }
        const parsed: T[] = [];
        for (const entry of value) {
          const result = validator(entry);
          if (!result.success) return mergeFailure(result, "Invalid array item");
          parsed.push(result.data);
        }
        return success(parsed);
      });
    },
    superRefine(refinement) {
      return createSchema((value) => {
        const baseResult = validator(value);
        if (!baseResult.success) return baseResult;
        const issues: ZodIssue[] = [];
        refinement(baseResult.data, {
          addIssue(issue) {
            issues.push(issue);
          },
        });
        if (issues.length > 0) {
          return {
            success: false,
            error: {
              issues,
              errors: issues,
              flatten: () => ({
                formErrors: issues.map((issue) => issue.message ?? "Invalid value"),
                fieldErrors: {},
              }),
            },
          };
        }
        return success(baseResult.data);
      });
    },
  };
}

export type StringSchema = ZodSchema<string> & {
  min: (length: number, message?: string) => StringSchema;
  max: (length: number, message?: string) => StringSchema;
  regex: (pattern: RegExp, message?: string) => StringSchema;
  trim: () => StringSchema;
  email: (message?: string) => StringSchema;
  uuid: () => StringSchema;
};

function stringSchema(validators: Array<(value: string) => ZodParseResult<string>> = []): StringSchema {
  const schemaValidator = (value: unknown): ZodParseResult<string> => {
    if (typeof value !== "string") {
      return failure("Invalid string");
    }
    let current = value;
    for (const check of validators) {
      const result = check(current);
      if (!result.success) return result;
      current = result.data;
    }
    return success(current);
  };

  const withValidator = (validate: (value: string) => ZodParseResult<string>) => stringSchema([...validators, validate]);

  const base = createSchema(schemaValidator);
  return {
    ...base,
    min(length, message) {
      return withValidator((value) =>
        value.length >= length ? success(value) : failure(message ?? `Must be at least ${length} characters`),
      );
    },
    max(length, message) {
      return withValidator((value) =>
        value.length <= length ? success(value) : failure(message ?? `Must be at most ${length} characters`),
      );
    },
    regex(pattern, message) {
      return withValidator((value) => (pattern.test(value) ? success(value) : failure(message ?? "Invalid format")));
    },
    trim() {
      return withValidator((value) => success(value.trim()));
    },
    email(message) {
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return withValidator((value) => (pattern.test(value) ? success(value) : failure(message ?? "Invalid email")));
    },
    uuid() {
      const pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      return withValidator((value) => (pattern.test(value) ? success(value) : failure("Invalid uuid")));
    },
  };
}

export type NumberSchema = ZodSchema<number> & {
  int: () => NumberSchema;
  positive: () => NumberSchema;
  max: (limit: number) => NumberSchema;
};

function numberSchema(validators: Array<(value: number) => ZodParseResult<number>> = []): NumberSchema {
  const schemaValidator = (value: unknown): ZodParseResult<number> => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return failure("Invalid number");
    }
    let current = value;
    for (const check of validators) {
      const result = check(current);
      if (!result.success) return result;
      current = result.data;
    }
    return success(current);
  };

  const withValidator = (validate: (value: number) => ZodParseResult<number>) => numberSchema([...validators, validate]);

  const base = createSchema(schemaValidator);
  return {
    ...base,
    int() {
      return withValidator((value) => (Number.isInteger(value) ? success(value) : failure("Expected integer")));
    },
    positive() {
      return withValidator((value) => (value > 0 ? success(value) : failure("Expected positive number")));
    },
    max(limit) {
      return withValidator((value) => (value <= limit ? success(value) : failure(`Must be at most ${limit}`)));
    },
  };
}

function booleanSchema(): ZodSchema<boolean> {
  return createSchema((value) => (typeof value === "boolean" ? success(value) : failure("Invalid boolean")));
}

function unknownSchema(): ZodSchema<unknown> {
  return createSchema((value) => success(value));
}

export type ZodEnum<T extends readonly [string, ...string[]]> = ZodSchema<T[number]> & {
  options: T;
  Enum: { [Value in T[number]]: Value };
};

function enumSchema<T extends readonly [string, ...string[]]>(values: T, options?: { errorMap?: (issue: { code?: string }) => { message: string } }): ZodEnum<T> {
  const validate = (value: unknown): ZodParseResult<T[number]> => {
    if (values.includes(value as T[number])) return success(value as T[number]);
    const message = options?.errorMap
      ? options.errorMap({ code: ISSUE_CODES.invalid_enum_value }).message
      : "Invalid value";
    return failure(message);
  };

  const base = createSchema(validate);
  const enumObject = values.reduce((acc, entry) => ({ ...acc, [entry]: entry }), {} as { [Value in T[number]]: Value });

  return Object.assign(base, { options: values, Enum: enumObject });
}

function objectSchema(shape: Record<string, ZodSchema<unknown>>): ZodSchema<Record<string, unknown>> & { shape: Record<string, ZodSchema<unknown>>; strict: () => ZodSchema<Record<string, unknown>> } {
  const validate = (value: unknown): ZodParseResult<Record<string, unknown>> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return failure("Invalid object");
    }
    const parsed: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(shape)) {
      const result = schema.safeParse((value as Record<string, unknown>)[key]);
      if (!result.success) {
        return mergeFailure(result, `Invalid value for ${key}`);
      }
      parsed[key] = result.data;
    }
    return success(parsed);
  };

  const base = createSchema(validate);
  return Object.assign(base, {
    shape,
    strict() {
      return base;
    },
  });
}

function recordSchema(keyOrValueSchema?: ZodSchema<unknown>, maybeValueSchema?: ZodSchema<unknown>): ZodSchema<Record<string, unknown>> {
  const keySchema = maybeValueSchema ? keyOrValueSchema : null;
  const valueSchema = maybeValueSchema ?? keyOrValueSchema ?? unknownSchema();

  return createSchema((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return failure("Invalid record");
    }
    const parsed: Record<string, unknown> = {};
    for (const [rawKey, rawValue] of Object.entries(value)) {
      if (keySchema) {
        const keyResult = keySchema.safeParse(rawKey);
        if (!keyResult.success) return mergeFailure(keyResult, "Invalid record key");
      }
      const valueResult = valueSchema.safeParse(rawValue);
      if (!valueResult.success) return mergeFailure(valueResult, "Invalid record value");
      parsed[rawKey] = valueResult.data;
    }
    return success(parsed);
  });
}

export const z = {
  enum: enumSchema,
  string: stringSchema,
  number: numberSchema,
  boolean: booleanSchema,
  unknown: unknownSchema,
  any: unknownSchema,
  record: recordSchema,
  object: objectSchema,
  optional<SchemaType>(schema: ZodSchema<SchemaType>) {
    return schema.optional();
  },
  ZodIssueCode: ISSUE_CODES,
};

export default z;
// @ts-nocheck
// Lightweight runtime shim for Zod used in environments without the real package.
