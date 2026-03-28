export async function register() {
  // Only run cron on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");

    // 매일 JST 19:35 (NHK 뉴스 19:30 업데이트 후)
    cron.default.schedule(
      "35 19 * * *",
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

    console.log("[cron] Scheduled daily refresh at 19:35 JST");
  }
}
