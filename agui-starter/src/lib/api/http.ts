import { NextResponse } from "next/server";

type JsonDetails = Record<string, unknown>;

export function jsonOk<Data>(data: Data, init: ResponseInit = {}) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(
  status: number,
  message: string,
  details?: JsonDetails,
  init: ResponseInit = {},
) {
  const payload = details ? { error: message, details } : { error: message };

  return NextResponse.json(payload, { status, ...init });
}
