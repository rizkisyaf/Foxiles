import React, { useState, useEffect, useCallback } from "react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import "./UploaderDashboard.css";
import {
  fetchUploaderFiles,
  updateFileMetadata,
} from "../utils/UploaderService";
import { sha256 } from "js-sha256";
import { prepareUpdateMetadataInstructionData } from "../utils/registerService";
import { SolanaWallet } from "@web3auth/solana-provider";

const programID = new PublicKey(`${process.env.REACT_APP_PROGRAM_ID}`);

const UploaderDashboard = ({ provider, web3auth }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [uploaderPublicKey, setUploaderPublicKey] = useState(null);
  const [walletPublicKey, setWalletPublicKey] = useState(null);
  const navigate = useNavigate();

  // Fetch uploaded files and display them
  const loadUploaderFiles = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch the public key from the Web3Auth provider
      const solanaWallet = new SolanaWallet(provider);
      const accounts = await solanaWallet.requestAccounts();
      const uploaderPublicKey = new PublicKey(accounts[0]);
      setWalletPublicKey(accounts[0]);

      // Fetch files uploaded by the user
      const uploadedFiles = await fetchUploaderFiles(uploaderPublicKey);
      setFiles(uploadedFiles);
      setStatus("");
    } catch (error) {
      console.error("Error fetching uploader files:", error);
      setStatus("Error loading your files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    if (provider && web3auth) loadUploaderFiles();
  }, [provider, web3auth, loadUploaderFiles]);

  const navigateToHome = () => {
    navigate("/dashboard");
  };

  const openEditFileModal = (file) => {
    setSelectedFile(file);
    setNewFileName(file.fileName);
    setNewDescription(file.description);
    setNewPrice(file.price);
  };

  const handleCopyProfileLink = () => {
    const profileLink = `${window.location.origin}/u/${walletPublicKey}`;
    navigator.clipboard.writeText(profileLink);
    alert("Uploader profile link copied to clipboard!");
  };

  const handleUpdateMetadata = async () => {
    try {
      if (!newFileName || !newDescription || !newPrice) {
        setStatus("Please provide all metadata fields.");
        return;
      }

      setLoading(true);
      setStatus("Updating file metadata...");

      // Convert new price to Lamports
      const newPriceInLamports = parseFloat(newPrice) * LAMPORTS_PER_SOL;

      // Get the user's wallet public key
      const solanaWallet = new SolanaWallet(provider);
      const accounts = await solanaWallet.requestAccounts();
      const uploaderPublicKey = accounts[0];

      // Prepare instruction data
      const instructionData = prepareUpdateMetadataInstructionData(
        newDescription,
        newPriceInLamports
      );

      // Derive PDA for the file using the same method as in Solana program
      const fileNameHash = Buffer.from(sha256.digest(selectedFile.fileName));

      const [fileInfoPda] = await PublicKey.findProgramAddressSync(
        [
          new PublicKey(uploaderPublicKey).toBuffer(),
          Buffer.from("file_info"),
          fileNameHash,
        ],
        programID
      );

      // Create the transaction
      const connectionConfig = await solanaWallet.request({
        method: "solana_provider_config",
        params: [],
      });
      const connection = new Connection(connectionConfig.rpcTarget);

      const transaction = new Transaction().add({
        keys: [
          {
            pubkey: new PublicKey(uploaderPublicKey),
            isSigner: true,
            isWritable: true,
          },
          { pubkey: fileInfoPda, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: programID,
        data: instructionData,
      });

      // Send the transaction
      const { signature } =
        await solanaWallet.signAndSendTransaction(transaction);
      console.log("Update transaction signature:", signature);

      setStatus("File metadata updated successfully.");
      loadUploaderFiles(); // Reload files after update
      setSelectedFile(null);
    } catch (error) {
      console.error("Error updating file metadata:", error);
      setStatus("Error updating file metadata. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="uploader-dashboard">
      <h2>Your Uploaded Files</h2>

      <button onClick={navigateToHome}>Go Back to Homepage</button>

      {/* Copy Profile Link Button */}
      <button onClick={handleCopyProfileLink}>Copy Profile Link</button>
      <p>Share this link with your buyers so they can view all your files.</p>

      {loading ? (
        <p>Loading your files...</p>
      ) : files.length === 0 ? (
        <p>No files uploaded yet.</p>
      ) : (
        <div className="file-list">
          {files.map((file) => (
            <div className="file-item" key={file.fileCid}>
              <h3>{file.fileName}</h3>
              <p>{file.description}</p>
              <p>Price: {file.price} SOL</p>
              {file.extraFee > 0 && (
                <p>Extra Fee for Size: {file.extraFee} SOL</p>
              )}

              <Link to={`/file/${file.fileCid}`}>
                <button>View Details</button>
              </Link>

              {/* Button to copy the link */}
              <button
                onClick={() => {
                  const shareLink = `${window.location.origin}/file/${file.fileCid}`;
                  navigator.clipboard.writeText(shareLink);
                  alert("Shareable link copied to clipboard!");
                }}
              >
                Copy Share Link
              </button>

              <button onClick={() => openEditFileModal(file)}>
                Edit Metadata
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedFile && (
        <div className="edit-modal">
          <h3>Edit File Metadata</h3>
          <label>File Name</label>
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
          />
          <label>Description</label>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <label>Price (in SOL)</label>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <button onClick={handleUpdateMetadata}>Save Changes</button>
          <button onClick={() => setSelectedFile(null)}>Cancel</button>
        </div>
      )}

      {status && <p>{status}</p>}
    </div>
  );
};

export default UploaderDashboard;
