import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { Oval } from "react-loader-spinner";
import { motion } from "framer-motion";
import { fetchUploaderFiles } from "../utils/UploaderService";
import { decryptFile, fetchEncryptedFileData } from "../utils/drmservice";
import { createQR, encodeURL, findReference } from "@solana/pay";
import logo from "../assets/2.png";
import BigNumber from "bignumber.js";
import "./BuyerPage.css";

const ITEMS_PER_PAGE = 8;
const PAYMENT_TIMEOUT = 180000; // 180 seconds

function BuyerPage({ provider }) {
  const { influencerId } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reference, setReference] = useState(null);
  const [paymentTimeout, setPaymentTimeout] = useState(null);
  const [paymentInterval, setPaymentInterval] = useState(null);
  const [countdown, setCountdown] = useState(PAYMENT_TIMEOUT / 1000);
  const [qrRendered, setQrRendered] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortOrder, setSortOrder] = useState("a-z");

  const connection = useMemo(() => {
    return new Connection(
      "https://solana-devnet.g.alchemy.com/v2/C191ERIvh8Hz0SAcEpq2_F3jr4wbMbHR"
    );
  }, []);

  // Fetch the uploader's files metadata
  const fetchUploaderFilesMetadata = useCallback(async () => {
    setLoading(true);
    setStatus("Fetching uploader's files...");
    try {
      // Check if influencerId is for a no-login user or a wallet user
      const storedFiles = localStorage.getItem(`files_${influencerId}`);
      if (storedFiles) {
        // Handle files uploaded by no-login users
        const filesWithMetadata = JSON.parse(storedFiles);
        setFiles(filesWithMetadata);
        setTotalPages(Math.ceil(filesWithMetadata.length / ITEMS_PER_PAGE));
      } else {
        // Handle files uploaded and registered on-chain
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
      }

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

  // Handle payment confirmation and file decryption
  const handlePaymentConfirmed = useCallback(async () => {
    setStatus("Payment confirmed. Preparing your file for decryption...");
    setOverlayLoading(true);

    try {
      const { encryptedData, metadata } = await fetchEncryptedFileData(
        selectedFile.fileCid
      );

      if (!metadata) {
        throw new Error("Metadata is missing or could not be fetched.");
      }

      if (
        !metadata ||
        !metadata.encryptionKey ||
        !metadata.iv ||
        !metadata.fileType ||
        !metadata.encryptionKey
      ) {
        throw new Error(
          "Missing required metadata fields (encryptionKey, iv, or fileType)."
        );
      }

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
      setReference(null);
      setSelectedFile(null);
      setQrRendered(false);
      clearTimeout(paymentTimeout);
      clearInterval(paymentInterval);
    }
  }, [selectedFile, paymentTimeout, paymentInterval]);

  // Handle preview file button click
  const handlePreviewFile = (file) => {
    navigate(`/file/${file.fileCid}`);
  };

  // Handle the "Buy with Crypto" button click
  const handleBuyFileWithCrypto = (file) => {
    const newReference = Keypair.generate().publicKey;
    setReference(newReference); // Set the reference

    setSelectedFile(file);
    setShowCryptoModal(true);
    setStatus("Please complete the payment to receive the file.");
    setCountdown(PAYMENT_TIMEOUT / 1000);
    setQrRendered(false);
  };

  // Handle copying the shareable link
  const handleCopyShareableLink = (file) => {
    let shareLink = `${window.location.origin}/file/${file.fileCid}`;
    const storedFiles = localStorage.getItem(`files_${influencerId}`);
    if (storedFiles) {
      // If the file is from a no-login user, add the `type` query parameter
      shareLink += "?type=no-login";
    }

    navigator.clipboard.writeText(shareLink);
    alert("Shareable link copied to clipboard!");
  };

  const handleModalClose = () => {
    setShowCryptoModal(false); // Close the modal
    setReference(null); // Reset reference
    setQrRendered(false); // Reset QR render flag
    setCountdown(PAYMENT_TIMEOUT / 1000); // Reset countdown
  };

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

  const handleSort = (order) => {
    setSortOrder(order);
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    setSearchKeyword(e.target.value);
    setCurrentPage(1);
  };

  const sortedFiles = files
    .filter(
      (file) =>
        file.fileName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        file.description.toLowerCase().includes(searchKeyword.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === "a-z") {
        return a.fileName.localeCompare(b.fileName);
      }
      return 0;
    });

  const paginatedFiles = sortedFiles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (showCryptoModal && reference && !qrRendered) {
      const amount = new BigNumber(selectedFile.price);
      const label = "Foxiles File Payment";
      const message = `Payment for file: ${selectedFile.fileName}`;

      const url = encodeURL({
        recipient: new PublicKey(influencerId),
        amount,
        reference,
        label,
        message,
      });
      const qr = createQR(url, 350, "transparent");
      qr.append(document.getElementById("solana-payment-qr"));
      setQrRendered(true);

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown > 1) {
            return prevCountdown - 1;
          } else {
            clearInterval(countdownInterval);
            return 0;
          }
        });
      }, 1000);

      // Start polling for payment confirmation
      const interval = setInterval(async () => {
        try {
          const signatureInfo = await findReference(connection, reference);
          if (signatureInfo.confirmationStatus === "finalized") {
            clearInterval(interval);
            clearInterval(countdownInterval);
            handlePaymentConfirmed();
          }
        } catch (err) {
          // Keep polling until payment is found or timeout
        }
      }, 2000);

      setPaymentInterval(interval);
      setPaymentTimeout(countdownInterval);
    }
  }, [
    showCryptoModal,
    reference,
    qrRendered,
    influencerId,
    connection,
    selectedFile,
    handlePaymentConfirmed,
  ]);

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

          <div className="controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search by file name or description..."
              value={searchKeyword}
              onChange={handleSearch}
            />
            <button onClick={() => handleSort("a-z")} className="sort-button">
              Sort A-Z
            </button>
          </div>

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
                  {file.price ? (
                    <p>Price: {file.price} SOL</p>
                  ) : (
                    <p>Preview only. No price set for this file.</p>
                  )}

                  <button
                    onClick={() => handleCopyShareableLink(file)}
                    className="buyer-ds-button"
                  >
                    Copy Shareable Link
                  </button>

                  {file.price ? (
                    <button
                      className="buyer-ds-button"
                      onClick={() => handleBuyFileWithCrypto(file)}
                    >
                      Buy with Crypto
                    </button>
                  ) : (
                    <button
                      className="buyer-ds-button"
                      onClick={() => handlePreviewFile(file)}
                    >
                      Preview File
                    </button>
                  )}
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
          {showCryptoModal && selectedFile && reference && (
            <div className="crypto-modal">
              <div className="modal-close" onClick={handleModalClose}>
                &times;
              </div>
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
