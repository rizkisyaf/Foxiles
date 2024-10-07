import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicKey, Connection, SystemProgram } from "@solana/web3.js";
import { Oval } from "react-loader-spinner";
import { motion } from "framer-motion";
import { fetchUploaderFiles } from "../utils/UploaderService";
import { createTransferTransaction } from "../utils/transactionService";
import { decryptFile, fetchEncryptedFileData } from "../utils/drmservice";
import { QRCodeCanvas } from "qrcode.react";
import logo from "../assets/2.png";
import "./BuyerPage.css";

const PAYMENT_TIMEOUT = 180; // 3 minutes
const ITEMS_PER_PAGE = 6;

function BuyerPage({ provider }) {
  const { influencerId } = useParams();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [socket, setSocket] = useState(null);
  const [timer, setTimer] = useState(PAYMENT_TIMEOUT);
  const [timerInterval, setTimerInterval] = useState(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
    }
  }, [selectedFile]);

  const clearTimer = useCallback(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [timerInterval]);

  // Polling mechanism to check payment status
  const startPollingPaymentStatus = useCallback(() => {
    setTimer(PAYMENT_TIMEOUT);
    const interval = setInterval(async () => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearTimer();
          setStatus("Payment timeout. Please try again.");
          setShowCryptoModal(false);
          return 0;
        }
        return prev - 1;
      });

      try {
        const response = await fetch("/check-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiver: influencerId,
            amount: selectedFile.price,
          }),
        });

        const data = await response.json();
        if (data.status === "confirmed") {
          clearTimer();
          handlePaymentConfirmed();
        }
      } catch (error) {
        console.error("Error checking payment:", error);
        setStatus("Error checking payment status. Please try again.");
      }
    }, 3000); // Poll every 3 seconds

    setTimerInterval(interval);
  }, [influencerId, selectedFile, clearTimer, handlePaymentConfirmed]);

  // Refactor: Replace WebSocket code with polling mechanism
  useEffect(() => {
    if (selectedFile && showCryptoModal) {
      setStatus("Waiting for payment confirmation...");
      startPollingPaymentStatus();
      clearTimer();
    }

    return () => {
      clearTimer();
    };
  }, [
    clearTimer,
    startPollingPaymentStatus,
    selectedFile,
    influencerId,
    showCryptoModal,
  ]);

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
          <h2 className="files-header">Files Uploaded by {influencerId}</h2>{" "}
          {/* Added this header */}
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
          {showCryptoModal && selectedFile && (
            <div className="crypto-modal">
              <div className="buyer-modal-content">
                <h4>Payment Instructions</h4>
                <p>Scan the QR code or copy the wallet address below to pay:</p>
                <QRCodeCanvas
                  value={`solana:${influencerId}?amount=${selectedFile.price}`}
                  size={200}
                />
                <p className="wallet-address-full">{influencerId}</p>
                <p>Time left to pay: {timer} seconds</p> {/* Countdown timer */}
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
