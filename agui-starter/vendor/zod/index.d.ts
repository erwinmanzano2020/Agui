export declare class ZodError extends Error {}

export type ZodEnum<T extends readonly [string, ...string[]]> = {
  options: T;
  parse: (input: unknown) => T[number];
  safeParse: (
    input: unknown,
  ) =>
    | { success: true; data: T[number] }
    | { success: false; error: ZodError };
};

export declare const z: {
  enum<T extends readonly [string, ...string[]]>(values: T): ZodEnum<T>;
};

export declare namespace z {
  type infer<T extends ZodEnum<any>> = T extends ZodEnum<infer Options> ? Options[number] : never;
}
