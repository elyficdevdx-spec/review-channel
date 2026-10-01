import QRCode from "qrcode";
import { endpointUrl } from "./urls";
export async function qrSvg(origin: string, shortCode: string) {
  return QRCode.toString(endpointUrl(origin, "qr", shortCode), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 320,
  });
}
export async function qrPng(origin: string, shortCode: string) {
  return QRCode.toBuffer(endpointUrl(origin, "qr", shortCode), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 640,
  });
}
