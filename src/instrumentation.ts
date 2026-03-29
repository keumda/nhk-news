export async function register() {
  // Only run cron on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");

    // 평일(월~금) JST 19:35 (NHK 뉴스 19:30 업데이트 후, 주말 제외)
    cron.default.schedule(
      "35 19 * * 1-5",
      async () => {
        console.log("[cron] Triggering daily refresh...");
        try {
          const port = process.env.PORT || 3000;
          const res = await fetch(
            `http://localhost:${port}/api/nhk/refresh`,
            { method: "POST" }
          );
          const data = await res.json();
          console.log("[cron] Refresh result:", data);
        } catch (err) {
          console.error("[cron] Refresh failed:", err);
        }
      },
      { timezone: "Asia/Tokyo" }
    );

    console.log("[cron] Scheduled weekday refresh at 19:35 JST (Mon-Fri)");
  }
}
