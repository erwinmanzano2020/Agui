class ZodError extends Error {
  constructor(issues = [], message = "Invalid input") {
    super(message);
    this.name = "ZodError";
    this.issues = Array.isArray(issues) ? issues : [];
  }

  flatten() {
    const fieldErrors = {};
    const formErrors = [];

    for (const issue of this.issues) {
      const message = issue && issue.message ? issue.message : this.message;
      const path = Array.isArray(issue?.path) ? issue.path : [];
      if (path.length === 0) {
        formErrors.push(message);
        continue;
      }
      const key = path.join(".");
      if (!fieldErrors[key]) {
        fieldErrors[key] = [];
      }
      fieldErrors[key].push(message);
    }

    return { fieldErrors, formErrors };
  }
}

const ZodIssueCode = Object.freeze({
  custom: "custom",
});

function withSafeParse(parse) {
  return (input) => {
    try {
      const data = parse(input);
      return { success: true, data };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false, error };
      }
      return {
        success: false,
        error: new ZodError([
          { message: error instanceof Error ? error.message : String(error) },
        ]),
      };
    }
  };
}

function wrapValidator(steps, validator) {
  return [...steps, (value) => {
    validator(value);
    return value;
  }];
}

function createOptionalSchema(schema) {
  const parse = (input) => {
    if (input === undefined) {
      return undefined;
    }
    return schema.parse(input);
  };

  let base;
  base = {
    parse,
    safeParse: withSafeParse(parse),
    optional() {
      return base;
    },
  };

  return base;
}

function createEnum(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ZodError("z.enum requires a non-empty array of values");
  }

  const frozen = Object.freeze([...values]);
  const allowed = new Set(frozen);

  const parse = (input) => {
    if (typeof input === "string" && allowed.has(input)) {
      return input;
    }
    throw new ZodError([
      { message: `Invalid enum value. Expected one of: ${frozen.join(", ")}` },
    ]);
  };

  let base;
  base = {
    options: frozen,
    parse,
    safeParse: withSafeParse(parse),
    optional() {
      return createOptionalSchema(base);
    },
  };

  return base;
}

function createString(steps = []) {
  const parse = (input) => {
    if (typeof input !== "string") {
      throw new ZodError([{ message: "Expected string" }]);
    }

    let value = input;
    for (const step of steps) {
      value = step(value);
    }

    return value;
  };

  let base;
  base = {
    parse,
    safeParse: withSafeParse(parse),
    min(length, message = `String must contain at least ${length} character(s)`) {
      return createString(
        wrapValidator(steps, (value) => {
          if (value.length < length) {
            throw new ZodError([{ message }]);
          }
        }),
      );
    },
    max(length, message = `String must contain at most ${length} character(s)`) {
      return createString(
        wrapValidator(steps, (value) => {
          if (value.length > length) {
            throw new ZodError([{ message }]);
          }
        }),
      );
    },
    trim() {
      return createString([...steps, (value) => String(value).trim()]);
    },
    refine(check, options = {}) {
      const message = options?.message ?? "Invalid value";
      return createString(
        wrapValidator(steps, (value) => {
          if (!check(value)) {
            throw new ZodError([{ message }]);
          }
        }),
      );
    },
    transform(transformer) {
      return createString([...steps, (value) => transformer(value)]);
    },
    optional() {
      return createOptionalSchema(base);
    },
  };

  return base;
}

function createNumber(steps = []) {
  const parse = (input) => {
    if (typeof input !== "number" || Number.isNaN(input)) {
      throw new ZodError([{ message: "Expected number" }]);
    }

    let value = input;
    for (const step of steps) {
      value = step(value);
    }

    return value;
  };

  let base;
  base = {
    parse,
    safeParse: withSafeParse(parse),
    min(minValue, message = `Number must be greater than or equal to ${minValue}`) {
      return createNumber(
        wrapValidator(steps, (value) => {
          if (value < minValue) {
            throw new ZodError([{ message }]);
          }
        }),
      );
    },
    max(maxValue, message = `Number must be less than or equal to ${maxValue}`) {
      return createNumber(
        wrapValidator(steps, (value) => {
          if (value > maxValue) {
            throw new ZodError([{ message }]);
          }
        }),
      );
    },
    int(message = "Expected integer") {
      return createNumber(
        wrapValidator(steps, (value) => {
          if (!Number.isInteger(value)) {
            throw new ZodError([{ message }]);
          }
        }),
      );
    },
    positive(message = "Number must be greater than 0") {
      return createNumber(
        wrapValidator(steps, (value) => {
          if (value <= 0) {
            throw new ZodError([{ message }]);
          }
        }),
      );
    },
    optional() {
      return createOptionalSchema(base);
    },
  };

  return base;
}

function createBoolean() {
  const parse = (input) => {
    if (typeof input !== "boolean") {
      throw new ZodError([{ message: "Expected boolean" }]);
    }
    return input;
  };

  let base;
  base = {
    parse,
    safeParse: withSafeParse(parse),
    optional() {
      return createOptionalSchema(base);
    },
  };

  return base;
}

function createUnknown() {
  const parse = (input) => input;

  let base;
  base = {
    parse,
    safeParse: withSafeParse(parse),
    optional() {
      return createOptionalSchema(base);
    },
  };

  return base;
}

function createObject(shape, config = {}) {
  const keys = Object.keys(shape ?? {});
  const strict = Boolean(config.strict);
  const superRefines = Array.isArray(config.superRefines)
    ? config.superRefines
    : [];

  const parse = (input) => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new ZodError([{ message: "Expected object" }]);
    }

    const result = {};
    const issues = [];

    for (const key of keys) {
      const schema = shape[key];
      if (!schema || typeof schema.safeParse !== "function") {
        result[key] = input[key];
        continue;
      }

      const parsed = schema.safeParse(input[key]);
      if (!parsed.success) {
        const childIssues = Array.isArray(parsed.error?.issues)
          ? parsed.error.issues
          : [{ message: parsed.error?.message }];

        for (const issue of childIssues) {
          const path = Array.isArray(issue?.path) ? issue.path : [];
          issues.push({
            message: issue?.message,
            path: [key, ...path],
          });
        }
      } else {
        result[key] = parsed.data;
      }
    }

    if (strict) {
      for (const key of Object.keys(input)) {
        if (!keys.includes(key)) {
          issues.push({
            message: `Unrecognized key: ${key}`,
            path: [key],
          });
        }
      }
    }

    if (superRefines.length > 0) {
      const ctx = {
        addIssue(issue = {}) {
          issues.push({
            message: issue.message ?? "Invalid input",
            path: Array.isArray(issue.path) ? issue.path : [],
            code: issue.code ?? ZodIssueCode.custom,
          });
        },
      };

      for (const refiner of superRefines) {
        refiner(result, ctx);
      }
    }

    if (issues.length > 0) {
      throw new ZodError(issues);
    }

    return result;
  };

  let base;
  base = {
    parse,
    safeParse: withSafeParse(parse),
    strict() {
      return createObject(shape, { strict: true, superRefines });
    },
    superRefine(refiner) {
      return createObject(shape, {
        strict,
        superRefines: [...superRefines, refiner],
      });
    },
  };

  return base;
}

const z = {
  enum(values) {
    return createEnum(values);
  },
  string() {
    return createString();
  },
  number() {
    return createNumber();
  },
  boolean() {
    return createBoolean();
  },
  unknown() {
    return createUnknown();
  },
  object(shape) {
    return createObject(shape);
  },
  ZodIssueCode,
};

z.ZodIssueCode = ZodIssueCode;

const api = {
  ...z,
  z,
  ZodError,
  ZodIssueCode,
};

module.exports = api;
module.exports.z = z;
module.exports.ZodError = ZodError;
module.exports.ZodIssueCode = ZodIssueCode;
module.exports.default = api;
