import { z } from "zod";
export const createAssetSchema = z.object({
  store_id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "販促物名を入力してください。")
    .max(120, "販促物名は120文字以内で入力してください。"),
});
export const updateAssetSchema = z.object({
  id: z.uuid(),
  name: createAssetSchema.shape.name,
  status: z.enum(["active", "inactive"]),
});
export const updateEndpointSchema = z.object({
  id: z.uuid(),
  asset_id: z.uuid(),
  status: z.enum(["active", "inactive"]),
});
