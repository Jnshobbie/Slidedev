import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImageToCloudinary(
  base64Image: string,
  importId: string,
  imageName: string
): Promise<string> {
  const result = await cloudinary.uploader.upload(base64Image, {
    folder: `slidedevai/imports/${importId}`,
    public_id: imageName.replace(/[^a-zA-Z0-9-_]/g, "_"),
    overwrite: true,
  });
  return result.secure_url;
}

export default cloudinary;