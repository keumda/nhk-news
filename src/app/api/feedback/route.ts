import { NextRequest, NextResponse } from "next/server";

/** POST /api/feedback — proxy to Google Apps Script → Google Sheets */
export async function POST(request: NextRequest) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json(
      { error: "GOOGLE_SCRIPT_URL 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const { category, message } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
    }

    // Google Apps Script executes doPost on the initial POST and returns
    // a 302 redirect. The data is already written to Google Sheets at
    // this point, so we treat 302 as success without following it.
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: category || "기타",
        message: message.trim(),
      }),
      redirect: "manual",
    });

    if (res.ok || res.status === 302) {
      return NextResponse.json({ success: true });
    }

    console.error("Google Script response:", res.status);
    return NextResponse.json({ error: "전송에 실패했습니다." }, { status: 502 });
  } catch (error) {
    console.error("Feedback proxy error:", error);
    return NextResponse.json({ error: "전송에 실패했습니다." }, { status: 500 });
  }
}
