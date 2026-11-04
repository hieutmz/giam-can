import type { EstimateImage } from "./types";

/**
 * Thu nhỏ ảnh về cạnh dài tối đa `maxSide` và nén JPEG trước khi gửi cho AI:
 * ảnh điện thoại 4–10 MB còn vài trăm KB, đủ rõ để nhận món, upload nhanh và rẻ hơn.
 */
export async function shrinkImage(file: File, maxSide = 1280, quality = 0.82): Promise<EstimateImage & { url: string }> {
  // createImageBitmap tự xoay ảnh theo EXIF (ảnh chụp dọc không bị nằm ngang)
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", quality);
  return { media_type: "image/jpeg", data: url.slice(url.indexOf(",") + 1), url };
}
