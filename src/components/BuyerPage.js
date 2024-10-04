import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { PublicKey, Connection, SystemProgram } from "@solana/web3.js";
import { Oval } from "react-loader-spinner";
import { motion } from "framer-motion";
import { fetchUploaderFiles } from "../utils/UploaderService";
import { createTransferTransaction } from "../utils/transactionService";
import { decryptFile, fetchEncryptedFileData } from "../utils/drmservice";
import { connectWallet } from "../utils/walletService"; // Wallet connection logic

const connection = new Connection("https://api.devnet.solana.com", "processed");
const platformFeeAccount = new PublicKey(
  process.env.REACT_APP_PLATFORM_FEE_ACCOUNT
);

function BuyerPage({ provider, walletServicesPlugin }) {
  const { influencerId } = useParams();
  const [files, setFiles] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  // Fetch all files uploaded by this specific influencer/uploader
  const fetchUploaderFilesMetadata = useCallback(async () => {
    setLoading(true);
    setStatus("Fetching uploader's files...");
    try {
      const uploaderPublicKey = new PublicKey(influencerId);
      const uploadedFiles = await fetchUploaderFiles(uploaderPublicKey); // Fetch from UploaderService

      setFiles(uploadedFiles);
      setStatus("");
    } catch (err) {
      console.error("Error fetching files:", err);
      setStatus("Error fetching files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [influencerId]);

  useEffect(() => {
    fetchUploaderFilesMetadata();
  }, [fetchUploaderFilesMetadata]);

  // This function is triggered when a buyer clicks the buy button
  const handleBuyFile = async (file) => {
    if (!provider) {
      // If provider is not available, redirect to login or trigger wallet connection
      navigate("/login");
      return;
    }

    if (!wallet) {
      try {
        // If the user hasn't connected their wallet yet, prompt them to do so
        const walletPublicKey = await connectWallet(provider);
        setWallet(walletPublicKey);
      } catch (err) {
        console.error("Login failed:", err);
        navigate("/login"); // Redirect to login if needed
        return;
      }
    }

    // Proceed with the buying process after wallet connection
    try {
      setLoading(true);
      setStatus("Processing transaction...");

      const ownerPublicKey = new PublicKey(influencerId);
      const priceInLamports = parseFloat(file.price) * 1e9;

      // Create a transaction for purchasing the file
      const transaction = await createTransferTransaction(
        connection,
        wallet,
        ownerPublicKey,
        (priceInLamports * 95) / 100 // Transfer 95% to the uploader
      );

      // Add platform fee (5%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet,
          toPubkey: platformFeeAccount,
          lamports: (priceInLamports * 5) / 100, // 5% platform fee
        })
      );

      // Send the transaction
      const signedTx = await provider.signAndSendTransaction(transaction);
      console.log("Transaction successful with signature:", signedTx);

      setStatus(
        "Transaction completed. Fetching DRM-protected download link..."
      );

      // Fetch and decrypt the file from IPFS
      const response = await fetch(
        `${process.env.REACT_APP_GATEWAY_URL}/ipfs/${file.fileCid}`
      );
      const encryptedFile = await response.arrayBuffer();
      const encryptionKey = process.env.REACT_APP_ENCRYPTION_KEY;
      const { encryptedData, iv } = await fetchEncryptedFileData(file.fileCid);
      const decryptedFile = decryptFile(encryptedData, encryptionKey, iv);

      // Create a download link for the decrypted file
      const blob = new Blob([decryptedFile], {
        type: "application/octet-stream",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.fileName;
      link.click();

      setStatus("Download started. DRM and self-destruction applied.");
    } catch (err) {
      console.error("Error during transaction:", err);
      setStatus("Error processing the transaction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="buyer-page-container">
      {loading ? (
        <div className="loading-container">
          <Oval color="#007bff" height={50} width={50} />
          <p>{status}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="file-details-container"
        >
          <h2>Files Uploaded by {influencerId}</h2>

          <button
            onClick={() => {
              const profileLink = `${window.location.origin}/u/${influencerId}`;
              navigator.clipboard.writeText(profileLink);
              alert("Uploader profile link copied to clipboard!");
            }}
          >
            Copy Profile Link
          </button>

          {files.length === 0 ? (
            <p>No files found for this uploader.</p>
          ) : (
            files.map((file) => (
              <div key={file.fileCid} className="file-item">
                <h3>{file.fileName}</h3>
                <p>{file.description}</p>
                <p>Price: {file.price} SOL</p>

                <Link to={`/file/${file.fileCid}`}>
                  <button>View Details</button>
                </Link>

                <button onClick={() => handleBuyFile(file)}>Buy</button>
              </div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}

export default BuyerPage;
