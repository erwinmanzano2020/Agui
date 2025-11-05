export type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  ref: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

export type InboxList = {
  unread: InboxItem[];
  read: InboxItem[];
  unreadCount: number;
};
