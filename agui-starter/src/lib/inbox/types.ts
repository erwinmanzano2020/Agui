export type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  ref: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
  entity_id?: string;
};

export type AppInboxRow = {
  id: string;
  entity_id: string;
  kind: string;
  title: string;
  body: string | null;
  ref: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

export type AppInboxUpdate = Partial<Pick<AppInboxRow, "read_at">>;

export type InboxList = {
  unread: InboxItem[];
  read: InboxItem[];
  unreadCount: number;
};
