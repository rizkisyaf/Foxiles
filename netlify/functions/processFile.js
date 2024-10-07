//server.mjs

import express from "express";
import axios from "axios";
import FormData from "form-data";
import cors from "cors";
import dotenv from "dotenv";
import { processFile } from "./drmservice.mjs";
import { Connection, PublicKey } from "@solana/web3.js";

dotenv.config();

// Initialize express app
const app = express();
app.use(cors({ origin: "http://localhost:3000" })); // Adjust origin as needed
app.use(express.json({ limit: "500mb" })); // Support large files

// Solana connection
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Route to process file
app.post("/process-file", async (req, res) => {
  try {
    const { fileBuffer, uploaderPublicKey, fileType, fileSizeMB } = req.body;

    // Decode base64 file buffer
    const decodedBuffer = Buffer.from(fileBuffer, "base64");

    console.log(
      "Processing file for:",
      uploaderPublicKey,
      "File type:",
      fileType
    );

    // Process file using DRM service
    const { drmBuffer, encryptionKey } = await processFile(
      decodedBuffer,
      uploaderPublicKey,
      fileType
    );

    // Return the processed file and encryption key to the client
    res.json({
      processedFile: drmBuffer.toString("base64"),
      encryptionKey: encryptionKey.toString("base64"),
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).send({ error: error.message });
  }
});

// Route to upload processed file to IPFS via Pinata
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

    const options = JSON.stringify({ cidVersion: 1 });
    formData.append("pinataOptions", options);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Content-Type": `multipart/form-data`,
          Authorization: `Bearer ${process.env.PINATA_JWT}`, // Set in Netlify Dashboard
          ...formData.getHeaders(),
        },
      }
    );

    res.json({ cid: response.data.IpfsHash });
  } catch (error) {
    console.error("Error uploading file to Pinata:", error);
    res.status(500).json({
      error: "Failed to upload file to Pinata",
      details: error.message || error,
    });
  }
});

// Fetch encrypted file from IPFS
app.get("/fetch-encrypted-file/:fileCid", async (req, res) => {
  const { fileCid } = req.params;

  try {
    const response = await axios.get(
      `${process.env.GATEWAY_URL}/ipfs/${fileCid}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        responseType: "arraybuffer", // Binary data
      }
    );

    res.set("Content-Type", "application/octet-stream");
    res.send(response.data);
  } catch (error) {
    console.error("Error fetching encrypted file data:", error.message);
    res.status(500).json({ error: "Failed to fetch encrypted file data" });
  }
});

// Add a route to check for payment
app.post("/check-payment", async (req, res) => {
  const { receiver, amount } = req.body;

  try {
    const accountInfo = await connection.getAccountInfo(
      new PublicKey(receiver)
    );

    // Check if accountInfo is null
    if (!accountInfo) {
      return res.status(404).json({
        status: "account_not_found",
        message: "The provided account does not exist.",
      });
    }

    const lamports = accountInfo.lamports / 1e9;

    if (lamports >= parseFloat(amount)) {
      return res.json({ status: "confirmed", receiver, amount });
    }

    res.json({ status: "pending", receiver, amount });
  } catch (error) {
    console.error("Error checking payment:", error);
    res.status(500).send({ error: error.message });
  }
});

// Netlify function export
export const handler = app;
