import { supabase } from "./supabase";

export interface CertificateRenderOptions {
  studentName: string;
  speakingBand: string;
  completionDate: string;
  certificateId: string;
  coachName: string;
}

const TEMPLATE_BUCKETS = [
  "certificates",
  "Assignment Certificate",
  "assignment certificate",
  "assignment_certificate",
  "assignment-certificate",
  "certificate-templates",
  "certificate_templates",
  "certificate-template",
  "certificate",
];
const TEMPLATE_PATHS = [
  "Assignment_Certificate",
  "Assignment_Certificate.png",
  "Assignment_Certificate.jpg",
  "Assignment_Certificate.jpeg",
  "certificate-template.png",
  "certificate-template.jpg",
  "certificate_template.png",
  "template.png",
  "template/Assignment_Certificate.png",
  "template/assignment_certificate.png",
  "templates/Assignment_Certificate.png",
  "templates/certificate-template.png",
];
const BASE_WIDTH = 1200;
const BASE_HEIGHT = 850;

async function loadFonts() {
  if (typeof window === "undefined" || !(window as any).FontFace || !window.document?.fonts) {
    return;
  }

  const fontFaces = [
    new FontFace(
      "Montserrat",
      "url(https://fonts.gstatic.com/s/montserrat/v25/JTUSjIg1_i6t8kCHKm45_cJD3gnD-w.woff2)",
      { style: "normal", weight: "700" },
    ),
    new FontFace(
      "Caveat",
      "url(https://fonts.gstatic.com/s/caveat/v31/Wnz6H9Xo9fM.woff2)",
      { style: "normal", weight: "400" },
    ),
  ];

  await Promise.all(
    fontFaces.map(async (fontFace) => {
      try {
        await fontFace.load();
        document.fonts.add(fontFace);
      } catch {
        // Ignore font loading failures and continue with system fallback fonts.
      }
    }),
  );

  if (document.fonts) {
    await document.fonts.ready;
  }
}

async function downloadTemplate(bucket: string, path: string) {
  try {
    const result = await supabase.storage.from(bucket).download(path);
    if (result.error || !result.data) {
      console.debug("[certificate-generator] template not found", { bucket, path, error: result.error?.message });
      return null;
    }
    return result.data;
  } catch (err) {
    console.debug("[certificate-generator] template download error", { bucket, path, error: err });
    return null;
  }
}

async function loadTemplateImage(): Promise<HTMLImageElement> {
  let data = null;
  for (const bucket of TEMPLATE_BUCKETS) {
    for (const path of TEMPLATE_PATHS) {
      data = await downloadTemplate(bucket, path);
      if (data) {
        break;
      }
    }
    if (data) {
      break;
    }
  }

  if (data) {
    const blobUrl = URL.createObjectURL(data);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = blobUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to load certificate template image."));
    });

    URL.revokeObjectURL(blobUrl);
    return image;
  }

  const image = new Image();
  const placeholderCanvas = document.createElement("canvas");
  placeholderCanvas.width = BASE_WIDTH;
  placeholderCanvas.height = BASE_HEIGHT;
  const ctx = placeholderCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  }
  image.src = placeholderCanvas.toDataURL("image/png");
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to create certificate placeholder image."));
  });
  return image;
}

function scaleCoordinate(value: number, scale: number, offset: number) {
  return offset + value * scale;
}

export async function renderCertificateBlob(options: CertificateRenderOptions): Promise<Blob> {
  await loadFonts();

  const image = await loadTemplateImage();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available.");
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / BASE_WIDTH;
  const scaleY = canvas.height / BASE_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (canvas.width - BASE_WIDTH * scale) / 2;
  const offsetY = (canvas.height - BASE_HEIGHT * scale) / 2;

  ctx.fillStyle = "#000000";
  ctx.textBaseline = "alphabetic";

  const studentPosX = scaleCoordinate(105, scale, offsetX);
  const studentPosY = scaleCoordinate(345, scale, offsetY);
  ctx.font = `bold ${Math.round(42 * scale)}px Montserrat, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(options.studentName, studentPosX, studentPosY);

  // Major Y-axis realignment per latest QA
  const bandPosX = scaleCoordinate(363, scale, offsetX);
  const bandPosY = scaleCoordinate(514, scale, offsetY);
  ctx.font = `bold ${Math.round(22 * scale)}px Montserrat, sans-serif`;
  ctx.fillText(options.speakingBand, bandPosX, bandPosY);

  const datePosX = scaleCoordinate(295, scale, offsetX);
  const datePosY = scaleCoordinate(547, scale, offsetY);
  ctx.font = `${Math.round(20 * scale)}px Montserrat, sans-serif`;
  ctx.fillText(options.completionDate, datePosX, datePosY);

  const idPosX = scaleCoordinate(260, scale, offsetX);
  const idPosY = scaleCoordinate(585, scale, offsetY);
  ctx.fillText(options.certificateId, idPosX, idPosY);
  
  const coachPosX = scaleCoordinate(240, scale, offsetX);
  const coachPosY = scaleCoordinate(725, scale, offsetY);
  ctx.font = `italic ${Math.round(30 * scale)}px Caveat, 'Dancing Script', serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#1A1A1A";
  ctx.fillText(options.coachName || "", coachPosX, coachPosY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate certificate blob."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
