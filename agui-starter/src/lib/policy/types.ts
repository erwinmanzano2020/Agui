export type PolicyRecord = {
  id: string;
  key: string;
  action: string;
  resource: string;
};

export type PolicyContext = Record<string, string | null | undefined>;

export type PolicyRequest = {
  action: string;
  resource?: string;
  context?: PolicyContext;
};
