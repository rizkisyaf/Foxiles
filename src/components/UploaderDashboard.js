import React, { useState, useEffect, useCallback } from "react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Link, useNavigate } from "react-router-dom";
import "./UploaderDashboard.css";
import {
  fetchUploaderFiles,
  updateFileMetadata,
} from "../utils/UploaderService";
import { sha256 } from "js-sha256";
import { prepareUpdateMetadataInstructionData } from "../utils/registerService";
import { SolanaWallet } from "@web3auth/solana-provider";
import logo from "../assets/2.png";

const programID = new PublicKey(`${process.env.REACT_APP_PROGRAM_ID}`);

const UploaderDashboard = ({
  provider = null,
  web3auth = null,
  noLoginAccount,
}) => {
  const isLoggedIn = provider && web3auth;
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [walletPublicKey, setWalletPublicKey] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState("a-z");
  const [searchKeyword, setSearchKeyword] = useState("");
  const navigate = useNavigate();
  const ITEMS_PER_PAGE = 8;

  // Function to fetch metadata for no-login user files
  const fetchMetadataForNoLoginFile = async (cid) => {
    try {
      const response = await fetch(
        `/.netlify/functions/fetchEncryptedFile/${cid}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch file data.");
      }

      // Get the file buffer from the response
      const base64File = await response.text();
      const fileBuffer = Buffer.from(base64File, "base64");

      console.log("Fetched file buffer length:", fileBuffer.length);

      // Extract metadata length
      const metadataLength = fileBuffer.readUInt32BE(0);
      console.log("Extracted metadata length:", metadataLength);

      if (metadataLength < 0 || metadataLength > fileBuffer.length) {
        throw new Error("Invalid metadata length.");
      }

      // Extract metadata buffer and parse it
      const metadataBuffer = fileBuffer.slice(4, 4 + metadataLength);
      console.log("Metadata buffer:", metadataBuffer.toString());
      const metadata = JSON.parse(metadataBuffer.toString());

      // If the metadata buffer is empty or incorrect, log detailed information
      if (!metadataBuffer || metadataBuffer.length !== metadataLength) {
        console.error(
          `Metadata length mismatch. Expected: ${metadataLength}, Actual: ${metadataBuffer.length}`
        );
        throw new Error("Metadata buffer extraction failed.");
      }

      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for file with CID: ${cid}`, error);
      return null;
    }
  };

  // Fetch uploaded files and display them
  const loadUploaderFiles = useCallback(async () => {
    try {
      setLoading(true);

      if (isLoggedIn) {
        const solanaWallet = new SolanaWallet(provider);
        const accounts = await solanaWallet.requestAccounts();
        const uploaderPublicKey = new PublicKey(accounts[0]);
        setWalletPublicKey(accounts[0]);

        const uploadedFiles = await fetchUploaderFiles(uploaderPublicKey, {
          limit: 100,
        });

        const filesWithMetadata = uploadedFiles.map((file) => ({
          ...file,
          fileType: file.fileType,
          fileSizeMB: file.fileSizeMB,
        }));

        setFiles(filesWithMetadata);
      } else if (noLoginAccount) {
        // Use the file CIDs from noLoginAccount.files
        const fileCids = noLoginAccount.files || [];
        const filesWithMetadata = await Promise.all(
          fileCids.map(async (cid) => {
            const metadata = await fetchMetadataForNoLoginFile(cid);
            if (metadata) {
              return { ...metadata, fileCid: cid };
            }
            return null;
          })
        );

        setFiles(filesWithMetadata.filter(Boolean)); // Remove any null values
      }

      setStatus("");
    } catch (error) {
      console.error("Error fetching uploader files:", error);
      setStatus("Error loading your files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [provider, noLoginAccount, isLoggedIn]);

  useEffect(() => {
    loadUploaderFiles();

    if (window.history.state && window.history.state.shouldReload) {
      loadUploaderFiles();
    }
  }, [loadUploaderFiles]);

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
    let profileLink = "";
    if (isLoggedIn) {
      profileLink = `${window.location.origin}/u/${walletPublicKey}`;
    } else if (noLoginAccount) {
      profileLink = `${window.location.origin}/u/${noLoginAccount.id}`;
    }

    if (profileLink) {
      navigator.clipboard.writeText(profileLink);
      alert("Uploader profile link copied to clipboard!");
    } else {
      alert("Unable to generate profile link.");
    }
  };

  const handleUpdateMetadata = async () => {
    if (!isLoggedIn) {
      alert("You need to be logged in to update metadata.");
      return;
    }

    try {
      if (!newFileName || !newDescription || !newPrice) {
        setStatus("Please provide all metadata fields.");
        return;
      }

      setLoading(true);
      setStatus("Updating file metadata...");

      const newPriceInLamports = parseFloat(newPrice) * LAMPORTS_PER_SOL;

      const solanaWallet = new SolanaWallet(provider);
      const accounts = await solanaWallet.requestAccounts();
      const uploaderPublicKey = accounts[0];

      const instructionData = prepareUpdateMetadataInstructionData(
        newDescription,
        newPriceInLamports
      );

      const fileNameHash = Buffer.from(sha256.digest(selectedFile.fileName));

      const [fileInfoPda] = await PublicKey.findProgramAddressSync(
        [
          new PublicKey(uploaderPublicKey).toBuffer(),
          Buffer.from("file_info"),
          fileNameHash,
        ],
        programID
      );

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

      const { signature } =
        await solanaWallet.signAndSendTransaction(transaction);
      console.log("Update transaction signature:", signature);

      setStatus("File metadata updated successfully.");

      setTimeout(() => {
        loadUploaderFiles();
      }, 3000);

      setSelectedFile(null);
    } catch (error) {
      console.error("Error updating file metadata:", error);
      setStatus("Error updating file metadata. Please try again.");
    } finally {
      setLoading(false);
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

  const totalPages = Math.ceil(sortedFiles.length / ITEMS_PER_PAGE);

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

  return (
    <div className="uploader-dashboard">
      <div className="header-container">
        <div className="left-side">
          <h2>Your Uploaded Files</h2>
          <div>
            <button onClick={navigateToHome} className="dashboard-button">
              Go Back to Homepage
            </button>
            <button
              onClick={handleCopyProfileLink}
              className="dashboard-button"
            >
              Copy Profile Link
            </button>
          </div>
          <p>Share this link so they can view all your files.</p>
        </div>
        <div className="right-side">
          <img src={logo} alt="Logo" className="logo" />
        </div>
      </div>

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

      {loading ? (
        <p>Loading your files...</p>
      ) : paginatedFiles.length === 0 ? (
        <p>No files uploaded yet.</p>
      ) : (
        <div className="file-list">
          {paginatedFiles.map((file) => (
            <div className="file-item" key={file.fileCid}>
              <h3>{file.fileName}</h3>
              <p>{file.description}</p>
              {isLoggedIn && <p>Price: {file.price} SOL</p>}
              {file.extraFee > 0 && isLoggedIn && (
                <p>Extra Fee for Size: {file.extraFee} SOL</p>
              )}

              <Link to={`/file/${file.fileCid}`}>
                <button className="ds-button">View Details</button>
              </Link>

              <button
                onClick={() => {
                  let shareLink = `${window.location.origin}/file/${file.fileCid}`;
                  if (!isLoggedIn) {
                    // If the uploader is a no-login user, add the `type` query parameter
                    shareLink += "?type=no-login";
                  }
                  navigator.clipboard.writeText(shareLink);
                  alert("Shareable link copied to clipboard!");
                }}
                className="ds-button"
              >
                Copy Share Link
              </button>

              {isLoggedIn && (
                <button
                  onClick={() => openEditFileModal(file)}
                  className="ds-button"
                >
                  Edit Metadata
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
