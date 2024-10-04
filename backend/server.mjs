//server.mjs

import express from "express";
import axios from "axios";
import FormData from "form-data";
import cors from "cors";
import dotenv from "dotenv";
import { processFile } from "./drmservice.mjs";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:3000" })); // Adjust origin as needed
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "500mb" })); // Increase the limit if needed for larger files
app.use(express.urlencoded({ extended: true }));

// Process file route
app.post("/process-file", async (req, res) => {
  try {
    const { fileBuffer, uploaderPublicKey, fileType } = req.body;

    // Decode the base64 file buffer
    const decodedBuffer = Buffer.from(fileBuffer, "base64");
    console.log("Decoded Buffer Size: ", decodedBuffer.length);

    console.log(
      `Processing file for: ${uploaderPublicKey} File type: ${fileType}`
    );

    // Process the file using your DRM service
    const { drmBuffer, encryptionKey } = await processFile(
      decodedBuffer,
      uploaderPublicKey,
      fileType
    );

    // Return both the processed file and encryption key to the frontend
    res.json({
      processedFile: drmBuffer.toString("base64"),
      encryptionKey: encryptionKey.toString("base64"),
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).send({ error: error.message });
  }
});

// Upload processed file to IPFS via Pinata
app.post("/upload-to-pinata", async (req, res) => {
  try {
    const fileBuffer = Buffer.from(req.body.fileBuffer, "base64");

    const formData = new FormData();
    formData.append("file", fileBuffer, "drmFile");

    const metadata = JSON.stringify({
      name: "DRM File",
      keyvalues: {
        encrypted: "true",
      },
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append("pinataOptions", options);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Content-Type": `multipart/form-data`,
          Authorization: `Bearer ${process.env.PINATA_JWT}`, // Ensure the JWT is valid
          ...formData.getHeaders(),
        },
      }
    );

    // Log the response from Pinata
    console.log("Pinata Response:", response.data);
    res.json({ cid: response.data.IpfsHash });
  } catch (error) {
    console.error("Error uploading file to Pinata:", error.message || error);
    res.status(500).json({
      error: "Failed to upload file to Pinata",
      details: error.message || error,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
