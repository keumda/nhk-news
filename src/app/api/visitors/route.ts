import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

export async function POST() {
  const dailyKey = `visitors:${todayKST()}`;
  const [total, daily] = await Promise.all([
    redis.incr("visitors:total"),
    redis.incr(dailyKey),
  ]);
  return NextResponse.json({ total, daily });
}

export async function GET() {
  const dailyKey = `visitors:${todayKST()}`;
  const [total, daily] = await Promise.all([
    redis.get<number>("visitors:total"),
    redis.get<number>(dailyKey),
  ]);
  return NextResponse.json({ total: total ?? 0, daily: daily ?? 0 });
}
