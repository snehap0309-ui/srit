import { z } from 'zod';

export const uploadSingleFileSchema = z.object({
  image: z.instanceof(File).optional(),
});

export const uploadMultipleFilesSchema = z.object({
  images: z.array(z.instanceof(File)).min(1).max(5).optional(),
});

export type UploadSingleFileInput = z.infer<typeof uploadSingleFileSchema>;
export type UploadMultipleFilesInput = z.infer<typeof uploadMultipleFilesSchema>;
