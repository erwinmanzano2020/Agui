-- POS receipts and numbering enhancements

alter table public.pos_sales
  add column if not exists receipt_number text,
  alter column discount_cents set default 0;

create unique index if not exists pos_sales_house_receipt_unique
  on public.pos_sales (house_id, receipt_number)
  where receipt_number is not null;

create unique index if not exists pos_sales_house_sequence_unique
  on public.pos_sales (house_id, sequence_no)
  where sequence_no is not null;
