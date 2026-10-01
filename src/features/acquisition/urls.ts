import type { EndpointType } from "./types";
export function endpointUrl(
  origin: string,
  type: EndpointType,
  shortCode: string,
) {
  const url = new URL(origin);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("公開URLはHTTPSで設定してください。");
  if (
    !["nfc", "qr"].includes(type) ||
    shortCode.length !== 32 ||
    !/^[a-f0-9]{32}$/.test(shortCode)
  )
    throw new Error("Invalid endpoint");
  return new URL(`/r/${type}/${shortCode}`, url.origin).href;
}
