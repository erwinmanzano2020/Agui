import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: 'Missing env vars', hasURL: !!url, hasKEY: !!key },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('dtr_with_rates')
    .select('work_date')
    .limit(1);

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    sample: data ?? [],
  }, { status: error ? 500 : 200 });
}
