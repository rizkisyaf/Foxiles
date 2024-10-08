import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { LAMPORTS_PER_SOL, PublicKey, Connection } from "@solana/web3.js";
import { Oval } from "react-loader-spinner";
import { motion } from "framer-motion";
import { fetchUploaderFiles } from "../utils/UploaderService";
import { decryptFile, fetchEncryptedFileData } from "../utils/drmservice";
import { createQR, encodeURL } from "@solana/pay";
import logo from "../assets/2.png";
import { v4 as uuidv4 } from "uuid";
import BigNumber from "bignumber.js";
import "./BuyerPage.css";

const ITEMS_PER_PAGE = 8;
const PAYMENT_CHECK_INTERVAL = 5000; // 5 seconds
const PAYMENT_TIMEOUT = 180000; // 180 seconds

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
  const [uniqueMemo, setUniqueMemo] = useState(null);
  const [paymentTimeout, setPaymentTimeout] = useState(null);
  const [paymentInterval, setPaymentInterval] = useState(null);
  const [countdown, setCountdown] = useState(PAYMENT_TIMEOUT / 1000);

  const connection = new Connection("https://api.devnet.solana.com");

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
      setUniqueMemo(null);
      setSelectedFile(null);
      clearTimeout(paymentTimeout);
      clearInterval(paymentInterval);
    }
  }, [selectedFile, paymentTimeout, paymentInterval]);

  useEffect(() => {
    if (showCryptoModal && uniqueMemo) {
      setStatus("Waiting for your payment...");

      const startPaymentProcess = async () => {
        try {
          // Fetch the latest blockhash when the modal appears
          const { blockhash: latestBlockhash } =
            await connection.getLatestBlockhash();

          const interval = setInterval(async () => {
            try {
              // Fetch signatures only after the latest blockhash
              const confirmedSignatures =
                await connection.getSignaturesForAddress(
                  new PublicKey(influencerId),
                  {
                    limit: 10,
                    before: latestBlockhash, // Limit to signatures after the blockhash
                  }
                );

              // Check for the payment with the unique memo
              const payment = confirmedSignatures.find(
                (signatureInfo) => signatureInfo.memo === uniqueMemo
              );

              if (payment) {
                setStatus("Payment received...");
                handlePaymentConfirmed(); // Call the payment confirmed handler
              }
            } catch (error) {
              console.error("Error checking payment status:", error);
            }
          }, PAYMENT_CHECK_INTERVAL);

          const timeout = setTimeout(() => {
            clearInterval(interval);
            setShowCryptoModal(false);
            setStatus(
              "Payment not completed within the time limit. Please try again."
            );
          }, PAYMENT_TIMEOUT);

          setPaymentInterval(interval);
          setPaymentTimeout(timeout);

          const countdownInterval = setInterval(() => {
            setCountdown((prevCountdown) => {
              if (prevCountdown <= 1) {
                clearInterval(countdownInterval);
                return 0;
              }
              return prevCountdown - 1;
            });
          }, 1000);

          return () => {
            clearInterval(interval);
            clearTimeout(timeout);
            clearInterval(countdownInterval);
          };
        } catch (error) {
          console.error("Error starting payment process:", error);
          setStatus("Error initializing the payment. Please try again.");
        }
      };

      startPaymentProcess();
    }
  }, [showCryptoModal, uniqueMemo, handlePaymentConfirmed, connection]);

  useEffect(() => {
    if (showCryptoModal && selectedFile && uniqueMemo) {
      const recipient = new PublicKey(influencerId);
      let priceInSOL = parseFloat(selectedFile.price);

      if (isNaN(priceInSOL) || priceInSOL <= 0) {
        console.error("Invalid price for selected file:", selectedFile.price);
        setStatus("Invalid price for the selected file. Please try again.");
        return;
      }
      console.log("Selected file price in SOL for QR code:", priceInSOL);

      const url = encodeURL({
        recipient,
        amount: new BigNumber(priceInSOL),
        memo: uniqueMemo,
      });

      const qr = createQR(url, 200, "transparent");
      const qrCodeElement = document.getElementById("solana-payment-qr");
      if (qrCodeElement) {
        qrCodeElement.innerHTML = "";
        qr.append(qrCodeElement);
      }
    }
  }, [showCryptoModal, selectedFile, uniqueMemo, influencerId]);

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
    if (!uniqueMemo || selectedFile !== file) {
      const newMemo = uuidv4();
      setUniqueMemo(newMemo);
    }

    setSelectedFile(file);
    setShowCryptoModal(true);
    setStatus("Please complete the payment to receive the file.");
    setCountdown(PAYMENT_TIMEOUT / 1000);
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
                <p>Scan the QR code or use a compatible wallet to pay:</p>
                <div id="solana-payment-qr"></div>{" "}
                <p className="wallet-address-full">{influencerId}</p>
                <p>Time remaining: {countdown} seconds</p>
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
