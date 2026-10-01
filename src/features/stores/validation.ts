import { z } from "zod";
import { isGoogleReviewUrl } from "@/lib/validation/google-review-url";
export { isGoogleReviewUrl } from "@/lib/validation/google-review-url";
export const storeSchema = z.object({
  name: z.string().trim().min(1, "店舗名を入力してください。").max(120),
  address: z.string().trim().min(1, "住所を入力してください。").max(500),
  google_review_url: z
    .string()
    .trim()
    .max(2048)
    .refine(isGoogleReviewUrl, "対応するGoogle口コミURLを入力してください。"),
  status: z.enum(["active", "inactive"]),
});
export type Store = z.infer<typeof storeSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
  google_account_id: string | null;
  google_location_id: string | null;
};
