import jsPDF from "jspdf";

export function exportToPDF({
  summary,
  activity,
  scores,
}: {
  summary: any;
  activity: any[];
  scores: any[];
}) {
  const pdf = new jsPDF();

  let y = 10;

  // 🔥 TITLE
  pdf.setFontSize(16);
  pdf.text("Admin Report", 10, y);

  y += 10;

  // 🔥 SUMMARY
  pdf.setFontSize(12);
  pdf.text(`Total Users: ${summary?.totalUsers ?? "-"}`, 10, y);
  y += 6;
  pdf.text(`Total Attempts: ${summary?.totalAttempts ?? "-"}`, 10, y);
  y += 6;
  pdf.text(`Average Score: ${summary?.avgScore ?? "-"}`, 10, y);

  y += 10;

  // 🔥 ACTIVITY SECTION
  pdf.setFontSize(14);
  pdf.text("Activity", 10, y);

  y += 6;

  pdf.setFontSize(10);
  activity.forEach((a) => {
    pdf.text(`${a.date}: ${a.count}`, 10, y);
    y += 5;

    // page break
    if (y > 280) {
      pdf.addPage();
      y = 10;
    }
  });

  y += 5;

  // 🔥 SCORE SECTION
  pdf.setFontSize(14);
  pdf.text("Score Trend", 10, y);

  y += 6;

  pdf.setFontSize(10);
  scores.forEach((s) => {
    pdf.text(`${s.date}: ${s.avg.toFixed(2)}`, 10, y);
    y += 5;

    if (y > 280) {
      pdf.addPage();
      y = 10;
    }
  });

  pdf.save("report.pdf");
}