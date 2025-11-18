import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const CLOUDINARY_CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      return res.status(500).json({ ok: false, error: 'Cloudinary config missing' });
    }

    // Get file from form data
    const formData = req.body;
    if (!formData) {
      return res.status(400).json({ ok: false, error: 'No file provided' });
    }

    // Forward to Cloudinary
    const cloudinaryFormData = new FormData();
    cloudinaryFormData.append('file', formData);
    cloudinaryFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: cloudinaryFormData,
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      return res.status(400).json({ ok: false, error: uploadData.error?.message || 'Upload failed' });
    }

    return res.json({
      ok: true,
      result: {
        secure_url: uploadData.secure_url,
        public_id: uploadData.public_id,
      },
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
