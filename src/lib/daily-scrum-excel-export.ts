import type { TeamDailyReportRow } from "@/lib/team-daily-log";

export type DailyScrumExcelExportOptions = {
  date: string;
  title: string;
  rows: TeamDailyReportRow[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cell(value: string | null | undefined): string {
  const text = value?.trim() ? value : "미입력";
  return `<td>${escapeHtml(text).replace(/\r?\n/g, "<br />")}</td>`;
}

export function buildDailyScrumExcelHtml({
  date,
  title,
  rows,
}: DailyScrumExcelExportOptions): string {
  const bodyRows = rows
    .map(
      (row) => `<tr>
        ${cell(date)}
        ${cell(row.member.name)}
        ${cell(row.tasks)}
        ${cell(row.yesterday_achievement)}
        ${cell(row.today_plan)}
        ${cell(row.bottleneck)}
        ${cell(row.hasReport ? "입력" : "미입력")}
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: "Malgun Gothic", Arial, sans-serif; font-size: 11pt; }
    th, td { border: 1px solid #d0d7de; padding: 6px 8px; vertical-align: top; white-space: pre-wrap; }
    th { background: #eef2ff; font-weight: 700; }
    .meta { background: #f8fafc; font-weight: 700; }
  </style>
</head>
<body>
  <table>
    <tr><td class="meta" colspan="7">${escapeHtml(title)}</td></tr>
    <tr><td class="meta" colspan="7">기준일: ${escapeHtml(date)}</td></tr>
    <tr>
      <th>일자</th>
      <th>담당자</th>
      <th>타스크</th>
      <th>전일 성과</th>
      <th>오늘 계획</th>
      <th>병목</th>
      <th>입력 여부</th>
    </tr>
    ${bodyRows}
  </table>
</body>
</html>`;
}

export function dailyScrumExcelFilename(date: string, title: string): string {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
  return `데일리_스크럼_일지_${date}_${safeTitle}.xls`;
}

export function downloadDailyScrumExcel(options: DailyScrumExcelExportOptions): void {
  const html = buildDailyScrumExcelHtml(options);
  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dailyScrumExcelFilename(options.date, options.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
