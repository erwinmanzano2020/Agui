class ZodError extends Error {
  constructor(message) {
    super(message);
    this.name = "ZodError";
  }
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
    safeParse(input) {
      try {
        const data = parse(input);
        return { success: true, data };
      } catch (error) {
        return { success: false, error };
      }
    },
  };
}

const z = {
  enum(values) {
    return createEnum(values);
  },
};

module.exports = {
  z,
  ZodError,
};
