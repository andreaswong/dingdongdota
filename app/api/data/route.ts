import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const data = await req.json();

  const keys = Object.keys(data);

  keys.forEach((key) => {
    if (!!data[key]) {
      console.log(data[key]);
    }
  })
  console.log('REQ', Object.keys(data), data.events);
  return NextResponse.json({});
}