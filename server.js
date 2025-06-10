require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Serve static HTML, CSS, JS files from the same directory
app.use(express.static(__dirname));

const r2 = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  signatureVersion: "v4",
  region: "auto"
});

const BUCKET = process.env.R2_BUCKET;

// Step 1: Initiate multipart upload (supports resume)
app.post("/initiate-upload", async (req, res) => {
  const { filename, contentType } = req.body;
  const timestamp = Date.now();
  const key = `uploads/${timestamp}-${filename}`;

  try {
    const params = {
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType
    };
    const { UploadId } = await r2.createMultipartUpload(params).promise();
    res.json({ uploadId: UploadId, key });
  } catch (err) {
    console.error("❌ Error initiating upload:", err);
    res.status(500).json({ error: "Failed to initiate upload" });
  }
});

// Step 2: Get presigned URL for part
app.post("/get-part-url", async (req, res) => {
  const { uploadId, partNumber, key } = req.body;

  try {
    const params = {
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Expires: 300
    };
    const url = await r2.getSignedUrlPromise("uploadPart", params);
    res.json({ url });
  } catch (err) {
    console.error("❌ Error generating part URL:", err);
    res.status(500).json({ error: "Failed to get part URL" });
  }
});

// Step 3: Complete multipart upload
app.post("/complete-upload", async (req, res) => {
  const { uploadId, key, parts } = req.body;

  try {
    const params = {
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
      }
    };
    await r2.completeMultipartUpload(params).promise();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error completing upload:", err);
    res.status(500).json({ error: "Failed to complete upload" });
  }
});

// Step 4 (NEW): List already uploaded parts (for resume logic)
app.post("/list-uploaded-parts", async (req, res) => {
  const { uploadId, key } = req.body;

  try {
    const params = {
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId
    };
    const data = await r2.listParts(params).promise();
    const uploadedParts = data.Parts.map(part => ({
      PartNumber: part.PartNumber,
      ETag: part.ETag
    }));
    res.json({ uploadedParts });
  } catch (err) {
    console.error("❌ Error listing uploaded parts:", err);
    res.status(500).json({ error: "Failed to list parts" });
  }
});

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
