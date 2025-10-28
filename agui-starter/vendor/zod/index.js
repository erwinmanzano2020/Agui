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
        error: new ZodError([{ message: error instanceof Error ? error.message : String(error) }]),
      };
    }
  };
}

function createEnum(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ZodError("z.enum requires a non-empty array of values");
  }

  const frozen = Object.freeze([...values]);
  const allowed = new Set(frozen);

  function parse(input) {
    if (typeof input === "string" && allowed.has(input)) {
      return input;
    }
    throw new ZodError(
      `Invalid enum value. Expected one of: ${frozen.join(", ")}`,
    );
  }

  return {
    options: frozen,
    parse,
    safeParse: withSafeParse(parse),
  };
}

function createString(validators = []) {
  const parse = (input) => {
    if (typeof input !== "string") {
      throw new ZodError([{ message: "Expected string" }]);
    }

    for (const validator of validators) {
      validator(input);
    }

    return input;
  };

  const base = {
    parse,
    safeParse: withSafeParse(parse),
    min(length, message = `String must contain at least ${length} character(s)`) {
      return createString([
        ...validators,
        (value) => {
          if (value.length < length) {
            throw new ZodError([{ message }]);
          }
        },
      ]);
    },
  };

  return base;
}

function createObject(shape) {
  const keys = Object.keys(shape ?? {});

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

    if (issues.length > 0) {
      throw new ZodError(issues);
    }

    return result;
  };

  return {
    parse,
    safeParse: withSafeParse(parse),
  };
}

const z = {
  enum(values) {
    return createEnum(values);
  },
  string() {
    return createString();
  },
  object(shape) {
    return createObject(shape);
  },
};

module.exports = {
  z,
  ZodError,
};
