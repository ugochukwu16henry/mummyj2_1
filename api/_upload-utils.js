import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config as loadEnv } from "dotenv";

function readS3Config() {
  return {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    region: process.env.S3_REGION || "us-east-1",
    bucketName: process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || process.env.BUCKET_NAME || "",
    endpoint: process.env.S3_ENDPOINT || "",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || "",
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || "true").toLowerCase() !== "false"
  };
}

function ensureS3Config() {
  let cfg = readS3Config();

  if (!cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucketName) {
    loadEnv();
    cfg = readS3Config();
  }

  const missing = [];
  if (!cfg.accessKeyId) missing.push("S3_ACCESS_KEY_ID/AWS_ACCESS_KEY_ID");
  if (!cfg.secretAccessKey) missing.push("S3_SECRET_ACCESS_KEY/AWS_SECRET_ACCESS_KEY");
  if (!cfg.bucketName) missing.push("S3_BUCKET_NAME/AWS_BUCKET_NAME/BUCKET_NAME");

  if (missing.length) {
    throw new Error(`S3 is not configured. Missing: ${missing.join(", ")}`);
  }

  return cfg;
}

function getS3Client() {
  const cfg = ensureS3Config();
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey
    }
  });
}

function safeFilename(fileName = "upload.bin") {
  const clean = String(fileName)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return clean || "upload.bin";
}

function encodeKey(key) {
  return String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function buildPublicFileUrl(key) {
  const cfg = ensureS3Config();
  const encodedKey = encodeKey(key);

  if (cfg.publicBaseUrl) {
    return `${cfg.publicBaseUrl.replace(/\/$/, "")}/${encodedKey}`;
  }

  if (cfg.endpoint) {
    return `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucketName}/${encodedKey}`;
  }

  return `https://${cfg.bucketName}.s3.${cfg.region}.amazonaws.com/${encodedKey}`;
}

export async function createPresignedUpload({ fileName, fileType, folder = "testimonials" }) {
  const cfg = ensureS3Config();
  const client = getS3Client();
  const safeName = safeFilename(fileName);
  const key = `${String(folder).replace(/^\/+|\/+$/g, "")}/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: cfg.bucketName,
    Key: key,
    ContentType: fileType || "application/octet-stream"
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 15 });
  const fileUrl = buildPublicFileUrl(key);

  return { key, uploadUrl, fileUrl };
}
