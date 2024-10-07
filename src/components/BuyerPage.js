import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { Oval } from "react-loader-spinner";
import { motion } from "framer-motion";
import { fetchUploaderFiles } from "../utils/UploaderService";
import { decryptFile, fetchEncryptedFileData } from "../utils/drmservice";
import { QRCodeCanvas } from "qrcode.react";
import logo from "../assets/2.png";
import { v4 as uuidv4 } from "uuid"; // For generating unique memo
import "./BuyerPage.css";

const ITEMS_PER_PAGE = 8;

function BuyerPage({ provider }) {
  const { influencerId } = useParams();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uniqueMemo, setUniqueMemo] = useState(null); // Unique memo for the buyer
  const wsRef = useRef(null); // Track WebSocket with useRef

  console.log("Influencer ID:", influencerId);

  // Fetch uploader files metadata
  const fetchUploaderFilesMetadata = useCallback(async () => {
    setLoading(true);
    setStatus("Fetching uploader's files...");
    try {
      const uploaderPublicKey = new PublicKey(influencerId);
      const uploadedFiles = await fetchUploaderFiles(uploaderPublicKey, {
        limit: 100,
      });
      const filesWithMetadata = uploadedFiles.map((file) => ({
        ...file,
        fileType: file.fileType,
        fileSizeMB: file.fileSizeMB,
      }));

      setFiles(filesWithMetadata);
      setTotalPages(Math.ceil(filesWithMetadata.length / ITEMS_PER_PAGE));
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

  // Handle payment confirmation logic
  const handlePaymentConfirmed = useCallback(async () => {
    setStatus("Payment confirmed. Preparing your file for decryption...");
    setOverlayLoading(true);

    try {
      const { encryptedData, metadata } = await fetchEncryptedFileData(
        selectedFile.fileCid
      );
      setStatus("Decrypting file...");
      const decryptedFile = decryptFile(
        encryptedData,
        metadata.encryptionKey,
        metadata.iv
      );

      const mimeType = metadata.fileType || "application/octet-stream";
      const fileExtension = mimeType.split("/")[1];
      const fileName = `${selectedFile.fileName}.${fileExtension}`;

      const blob = new Blob([decryptedFile], {
        type: mimeType,
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();

      setStatus("Download started... DRM and self-destruction applied...");
    } catch (err) {
      console.error("Error during file decryption or download:", err);
      setStatus("Error processing the download. Please try again.");
    } finally {
      setOverlayLoading(false);
      setShowCryptoModal(false);
      setUniqueMemo(null); // Reset memo after transaction completes
    }
  }, [selectedFile]);

  // WebSocket setup and handle payment confirmation
  useEffect(() => {
    if (showCryptoModal && selectedFile && uniqueMemo) {
      // Establish WebSocket connection
      wsRef.current = new WebSocket("wss://foxiles.xyz");

      wsRef.current.onopen = () => {
        console.log("WebSocket connection established");
        setStatus("Waiting for payment confirmation...");

        // Send payment details to WebSocket server
        wsRef.current.send(
          JSON.stringify({
            receiver: influencerId,
            amount: selectedFile.price,
            memo: uniqueMemo,
          })
        );
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.status === "success") {
          handlePaymentConfirmed(); // Call payment confirmation handler
        } else if (data.status === "not_found") {
          console.log("Payment not found, waiting...");
        } else {
          console.error("WebSocket Error:", data.message);
          setStatus("Error processing payment. Please try again.");
          setShowCryptoModal(false);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setStatus("Error connecting to payment server.");
        setShowCryptoModal(false);
      };

      return () => {
        if (wsRef.current) {
          wsRef.current.close(); // Close WebSocket connection on cleanup
        }
      };
    }
  }, [showCryptoModal, selectedFile, uniqueMemo, influencerId, handlePaymentConfirmed]);

  // Pagination and file display logic
  const paginatedFiles = files.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleBuyFileWithCrypto = (file) => {
    // Generate a unique memo only when a file is selected for purchase
    if (!uniqueMemo || selectedFile !== file) {
      const newMemo = uuidv4(); // Use UUID for uniqueness
      setUniqueMemo(newMemo);
    }

    setSelectedFile(file);
    setShowCryptoModal(true);
    setStatus("Please complete the payment to receive the file.");
  };

  return (
    <div className="buyer-page-container">
      {loading ? (
        <div className="buyer-loading-container">
          <Oval color="#007bff" height={50} width={50} />
          <p>{status}</p>
        </div>
      ) : (
        <motion.div className="buyer-file-details-container">
          <div className="header-section">
            <div className="logo-container">
              <img src={logo} alt="Foxiles Logo" className="logo" />
              <div className="beta-tag">
                <span>BETA IN DEVNET</span>
              </div>
            </div>
            <button
              onClick={() => {
                const profileLink = `${window.location.origin}/u/${influencerId}`;
                navigator.clipboard.writeText(profileLink);
                alert("Uploader profile link copied to clipboard!");
              }}
              className="copy-profile-button"
            >
              Copy Profile Link
            </button>
          </div>
          <h2 className="files-header">Files Uploaded by {influencerId}</h2>
          <div className="files-section">
            {paginatedFiles.length === 0 ? (
              <p>No files found for this uploader.</p>
            ) : (
              paginatedFiles.map((file) => (
                <div key={file.fileCid} className="buyer-file-item">
                  <h3>{file.fileName}</h3>
                  <p>Type: {file.fileType}</p>
                  <p>Size: {file.fileSizeMB} MB</p>
                  <p>{file.description}</p>
                  <p>Price: {file.price} SOL</p>

                  <button
                    className="buyer-ds-button"
                    onClick={() => handleBuyFileWithCrypto(file)}
                  >
                    Buy with Crypto
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-button"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-button"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
          {showCryptoModal && selectedFile && uniqueMemo && (
            <div className="crypto-modal">
              <div className="buyer-modal-content">
                <h4>Payment Instructions</h4>
                <p>Scan the QR code or copy the wallet address below to pay:</p>
                <QRCodeCanvas
                  value={`solana:${influencerId}?amount=${selectedFile.price}&memo=${uniqueMemo}`} // Include the memo in the QR code
                  size={200}
                />
                <p className="wallet-address-full">{influencerId}</p>
                <button
                  onClick={() => setShowCryptoModal(false)}
                  className="close-modal-button"
                >
                  Close
                </button>
                {overlayLoading && (
                  <div className="overlay-loading">
                    <Oval color="#007bff" height={50} width={50} />
                    <p>{status}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default BuyerPage;
