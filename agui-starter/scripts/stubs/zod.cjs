function enumSchema(values, options = {}) {
  return {
    safeParse(value) {
      const success = values.includes(value);
      if (success) return { success: true, data: value };
      const message = options.errorMap
        ? options.errorMap({ code: "invalid_enum_value" }).message
        : "Invalid value";
      return { success: false, error: { issues: [{ message }] } };
    },
    parse(value) {
      const result = this.safeParse(value);
      if (!result.success) {
        throw new Error(result.error?.issues?.[0]?.message ?? "Invalid value");
      }
      return value;
    },
  };
}

function stringSchema() {
  const base = {
    safeParse(value) {
      const success = typeof value === "string";
      return success
        ? { success: true, data: value }
        : { success: false, error: { issues: [{ message: "Invalid string" }] } };
    },
    parse(value) {
      const result = this.safeParse(value);
      if (!result.success) throw new Error(result.error?.issues?.[0]?.message ?? "Invalid string");
      return result.data;
    },
  };

  return Object.assign(base, {
    uuid() {
      const pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      return {
        safeParse(value) {
          const success = typeof value === "string" && pattern.test(value);
          return success
            ? { success: true, data: value }
            : { success: false, error: { issues: [{ message: "Invalid uuid" }] } };
        },
        parse(value) {
          const result = this.safeParse(value);
          if (!result.success) throw new Error(result.error?.issues?.[0]?.message ?? "Invalid uuid");
          return result.data;
        },
      };
    },
  });
}

function numberSchema() {
  return {
    safeParse(value) {
      const success = typeof value === "number" && Number.isFinite(value);
      return success
        ? { success: true, data: value }
        : { success: false, error: { issues: [{ message: "Invalid number" }] } };
    },
    parse(value) {
      const result = this.safeParse(value);
      if (!result.success) throw new Error(result.error?.issues?.[0]?.message ?? "Invalid number");
      return result.data;
    },
  };
}

function objectSchema(shape) {
  return {
    safeParse(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { success: false, error: { issues: [{ message: "Invalid object" }] } };
      }
      const parsed = {};
      for (const key of Object.keys(shape ?? {})) {
        const schema = shape[key];
        const result = schema?.safeParse ? schema.safeParse(value[key]) : { success: true, data: value[key] };
        if (!result.success) {
          return { success: false, error: result.error ?? { issues: [{ message: "Invalid value" }] } };
        }
        parsed[key] = result.data;
      }
      return { success: true, data: parsed };
    },
    parse(value) {
      const result = this.safeParse(value);
      if (!result.success) throw new Error(result.error?.issues?.[0]?.message ?? "Invalid object");
      return result.data;
    },
  };
}

const z = {
  enum: enumSchema,
  string: stringSchema,
  number: numberSchema,
  object: objectSchema,
};

module.exports = {
  z,
  default: z,
  enumSchema,
  stringSchema,
  objectSchema,
  numberSchema,
};
