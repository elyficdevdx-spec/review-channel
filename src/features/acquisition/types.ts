export type EndpointType = "nfc" | "qr";
export type Status = "active" | "inactive";
export type Endpoint = {
  id: string;
  acquisition_asset_id: string;
  type: EndpointType;
  short_code: string;
  destination_url: string;
  status: Status;
};
export type Asset = {
  id: string;
  store_id: string;
  name: string;
  status: Status;
  created_at: string;
  stores: { name: string; status: Status };
  acquisition_endpoints: Endpoint[];
};
export type AccessCount = {
  asset_id: string;
  nfc: number;
  qr: number;
  total: number;
};
export type RecentAccess = {
  id: string;
  access_method: EndpointType;
  accessed_at: string;
  redirected_at: string;
};
