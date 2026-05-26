import * as XLSX from "xlsx-js-style";

export const exportToExcel = (
  data: any[],
  fileName = "report.xlsx"
) => {

  const worksheet =
    XLSX.utils.json_to_sheet(data);

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Report"
  );

  const range =
    XLSX.utils.decode_range(
      worksheet["!ref"] || ""
    );

  // HEADER STYLE
  for (
    let col = range.s.c;
    col <= range.e.c;
    col++
  ) {

    const cell =
      XLSX.utils.encode_cell({
        r: 0,
        c: col,
      });

    if (!worksheet[cell]) continue;

    worksheet[cell].s = {

      font: {
        bold: true,
        color: {
          rgb: "FFFFFF",
        },
      },

      fill: {
        fgColor: {
          rgb: "C95B5B",
        },
      },

      alignment: {
        horizontal: "center",
        vertical: "center",
      },

      border: {
        top: {
          style: "thin",
          color: {
            rgb: "D1D5DB",
          },
        },

        bottom: {
          style: "thin",
          color: {
            rgb: "D1D5DB",
          },
        },

        left: {
          style: "thin",
          color: {
            rgb: "D1D5DB",
          },
        },

        right: {
          style: "thin",
          color: {
            rgb: "D1D5DB",
          },
        },
      },
    };
  }

  // INFO SECTION STYLE
  for (let row = 1; row <= 2; row++) {

    for (
      let col = range.s.c;
      col <= range.e.c;
      col++
    ) {

      const cell =
        XLSX.utils.encode_cell({
          r: row,
          c: col,
        });

      if (!worksheet[cell]) continue;

      worksheet[cell].s = {

        font: {
          bold: row === 1,
          color: {
            rgb: "1F2937",
          },
        },

        fill: {
          fgColor: {
            rgb:
              row === 1
                ? "FFC5C4"
                : "FFF9F9",
          },
        },

        border: {
          top: {
            style: "thin",
            color: {
              rgb: "D1D5DB",
            },
          },

          bottom: {
            style: "thin",
            color: {
              rgb: "D1D5DB",
            },
          },

          left: {
            style: "thin",
            color: {
              rgb: "D1D5DB",
            },
          },

          right: {
            style: "thin",
            color: {
              rgb: "D1D5DB",
            },
          },
        },
      };
    }
  }

  // AUTO WIDTH
  worksheet["!cols"] = Object.keys(
    data[0] || {}
  ).map((key) => ({
    wch: Math.max(
      key.length,
      18
    ),
  }));

  XLSX.writeFile(
    workbook,
    fileName
  );
};