//homepage.js
import React, { useState, useEffect } from "react";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  Connection,
} from "@solana/web3.js";
import {
  validateInput,
  getConnection,
  prepareInstructionData,
} from "../utils/registerService";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Oval } from "react-loader-spinner";
import { initializePlatformState } from "../utils/PlatformService";
import "./HomePage.css";
import { SolanaWallet } from "@web3auth/solana-provider";
import { FileRegistration } from "../utils/types";
import { sha256 } from "js-sha256";

const programID = new PublicKey(`${process.env.REACT_APP_PROGRAM_ID}`);

function HomePage({ provider, walletServicesPlugin, web3auth }) {
  const [file, setFile] = useState(null);
  const [fileSizeMB, setFileSizeMB] = useState(0);
  const [fileCid, setFileCid] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [walletPublicKey, setWalletPublicKey] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusColor, setStatusColor] = useState("");
  const [platformStatePubKey, setPlatformStatePubKey] = useState(null);
  const [platformFee, setPlatformFee] = useState(0.01);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlatformState = async () => {
      try {
        const platformStatePubKey = await initializePlatformState();
        setPlatformStatePubKey(platformStatePubKey);
        console.log(
          "Fetched Platform State Public Key:",
          platformStatePubKey.toBase58()
        );
      } catch (error) {
        console.error("Error fetching platform state:", error);
      }
    };

    const fetchWalletPublicKey = async () => {
      try {
        if (!web3auth || !web3auth.provider) {
          throw new Error("Web3Auth provider not initialized");
        }

        // Change method from 'solana_requestAccounts' to 'requestAccounts'
        const accounts = await web3auth.provider.request({
          method: "requestAccounts",
        });

        if (accounts && accounts[0]) {
          setWalletPublicKey(accounts[0]);
          console.log("Fetched wallet public key:", accounts[0]);
        } else {
          console.error("No accounts found.");
        }
      } catch (error) {
        console.error("Error fetching wallet public key:", error);
      }
    };

    if (provider && web3auth) {
      fetchPlatformState();
      fetchWalletPublicKey();
    }
  }, [provider, web3auth]);

  const navigateToDashboard = () => {
    navigate("/uploaderdashboard");
  };

  const handleFileUpload = (event) => {
    if (event.target.files) {
      const selectedFile = event.target.files[0];

      const fileSizeMB = parseFloat(
        (selectedFile.size / (1024 * 1024)).toFixed(2)
      );
      const maxSizeMB = 500;

      if (fileSizeMB > maxSizeMB) {
        alert(
          `The selected file is too large. Maximum allowed size is ${maxSizeMB} MB.`
        );
        setFile(null);
        setFileSizeMB(0); // Reset file size if file is too large
      } else {
        setFile(selectedFile);
        setFileSizeMB(fileSizeMB); // Set the file size as a number

        // Extract file type (e.g., image/png, video/mp4)
        const fileType = selectedFile.type;
        setFileType(fileType); // Set the file type in the state for later use
        console.log("File type: ", fileType); // Log the file type for debugging
      }
    }
  };

  const uploadToPinata = async () => {
    if (!file || !fileName || !price || !description || !platformStatePubKey) {
      alert("Please provide all file details.");
      return;
    }

    if (description.length > 1000) {
      alert("Description too long! Limit it to 1000 characters.");
      return;
    }

    setLoading(true);
    setStatusColor("");
    setStatus("Processing and uploading file...");

    try {
      // Step 1: Read the file into a buffer
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(fileArrayBuffer);

      console.log("File type: ", file.type); // Debug log
      console.log("File size (bytes): ", file.size); // Debug log

      // Use 'image' as file type for image files
      const fileType = file.type;

      // Step 2: Process the file by sending it to the backend
      const processResponse = await fetch(
        "http://localhost:5000/process-file",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileBuffer: fileBuffer.toString("base64"),
            uploaderPublicKey: walletPublicKey,
            fileType,
          }),
        }
      );

      if (!processResponse.ok) {
        throw new Error(`Server error: ${processResponse.status}`);
      }

      const { processedFile, encryptionKey } = await processResponse.json();
      const encryptionKeyBuffer = Buffer.from(encryptionKey, "base64");
      const processedFileBuffer = Buffer.from(processedFile, "base64");

      // Step 3: Upload processed file to Pinata
      const uploadResponse = await fetch(
        "http://localhost:5000/upload-to-pinata",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileBuffer: processedFileBuffer.toString("base64"),
          }),
        }
      );

      const uploadData = await uploadResponse.json();
      const cid = uploadData?.cid;

      if (!cid) {
        throw new Error("Failed to retrieve CID from Pinata");
      }

      setFileCid(cid);
      setFileUrl(`https://ipfs.io/ipfs/${cid}`);
      setStatus("File uploaded. Registering file on-chain...");

      // Register file on-chain and pass the encryption key
      await registerFileOnChain(
        cid,
        fileName,
        price,
        description,
        0,
        encryptionKeyBuffer,
        fileSizeMB,
        fileType
      );
    } catch (error) {
      console.error("Error during file processing or upload:", error);
      setStatusColor("red");
      setStatus("Error during upload or Registering File.");
    } finally {
      setLoading(false);
    }
  };

  const registerFileOnChain = async (
    cid,
    fileName,
    price,
    description,
    additionalFee,
    encryptionKeyBuffer,
    fileSizeMB,
    fileType
  ) => {
    try {
      // Validate user input
      validateInput(cid, fileName, description, price, fileType);

      if (!provider || !walletPublicKey) {
        throw new Error("Wallet or platform state not available.");
      }

      const solanaWallet = new SolanaWallet(provider);

      // Get connection details
      const connectionConfig = await solanaWallet.request({
        method: "solana_provider_config",
        params: [],
      });
      const connection = new Connection(connectionConfig.rpcTarget);

      // Get accounts
      const accounts = await solanaWallet.requestAccounts();

      const priceInLamports =
        (parseFloat(price) + additionalFee) * LAMPORTS_PER_SOL;

      const instructionData = prepareInstructionData(
        fileName,
        cid,
        description,
        priceInLamports,
        fileSizeMB,
        fileType,
        encryptionKeyBuffer
      );

      const platformFeeAccount = new PublicKey(
        process.env.REACT_APP_PLATFORM_FEE_ACCOUNT
      );

      // Hash the file name
      const fileNameHash = Buffer.from(sha256.digest(fileName));

      // Deriving the Program Derived Address (PDA)
      const [fileInfoPda, bumpSeed] = await PublicKey.findProgramAddressSync(
        [
          new PublicKey(walletPublicKey).toBuffer(),
          Buffer.from("file_info"),
          fileNameHash,
        ],
        programID
      );

      console.log("Derived File Info PDA:", fileInfoPda.toBase58());

      // Check if PDA already exists
      const fileInfoAccount = await connection.getAccountInfo(fileInfoPda);

      if (!fileInfoAccount) {
        console.log("File info account does not exist, creating it...");

        // Fetch latest blockhash
        const block = await connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", block.blockhash);
        console.log("Last Valid Block Height:", block.lastValidBlockHeight);

        const transaction = new Transaction({
          blockhash: block.blockhash,
          lastValidBlockHeight: block.lastValidBlockHeight,
          feePayer: new PublicKey(accounts[0]),
        }).add({
          keys: [
            {
              pubkey: new PublicKey(walletPublicKey),
              isSigner: true,
              isWritable: true,
            },
            { pubkey: fileInfoPda, isSigner: false, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
            { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
          ],
          programId: programID,
          data: instructionData,
        });

        // Use signAndSendTransaction directly
        const { signature } =
          await solanaWallet.signAndSendTransaction(transaction);
        console.log("Transaction successful with signature:", signature);

        // Update UI status
        setStatusColor("green");
        setStatus("File successfully registered.");
        navigate("/uploaderdashboard");
      } else {
        console.log("File info account already exists, skipping creation.");
        // Proceed with updating or using the file account logic here...
      }
    } catch (err) {
      console.error("Error during transaction:", err);
      handleErrorStatus(err);
    }
  };

  const handleErrorStatus = (err) => {
    if (err.message.includes("transaction")) {
      setStatusColor("red");
      setStatus(
        "Transaction failed. Please check your network or wallet connection."
      );
    } else if (err.message.includes("insufficient funds")) {
      setStatusColor("red");
      setStatus("Insufficient funds to complete the transaction.");
    } else {
      setStatusColor("red");
      setStatus(
        "An issue occurred while securely processing your file. Please try again."
      );
    }
  };

  const handleFiatPayment = async () => {
    try {
      if (!walletServicesPlugin) {
        throw new Error("Wallet Services Plugin is not initialized");
      }

      const fiatOnRampResponse = await walletServicesPlugin.connectToOnramp({
        provider: "moonpay",
        amount: platformFee,
        currency: "USD",
      });

      window.location.href = fiatOnRampResponse.onrampURL;
    } catch (error) {
      console.error("Error processing fiat payment:", error);
      setStatusColor("red");
      setStatus("Error during fiat payment. Please try again.");
    }
  };

  return (
    <div className="homepage-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo" onClick={() => navigate("/")}>
          <img src="/path/to/logo.svg" alt="Logo" className="logo" />
          <h2>Foxiles</h2>
        </div>
        <div className="wallet-info">
          {walletPublicKey ? (
            <p className="wallet-display">{`${walletPublicKey.slice(0, 4)}...${walletPublicKey.slice(-4)}`}</p>
          ) : (
            <p>Loading wallet...</p>
          )}
        </div>
        <div>
        <button onClick={navigateToDashboard}>
          Dashboard
        </button>
        </div>
      </nav>

      {/* File Upload Section */}
      <div className="file-upload-section">
        <motion.h2 className="file-upload-heading">
          Upload Your Digital Asset
        </motion.h2>

        {/* File Upload Inputs */}
        <motion.div className="file-upload-input">
          <input
            type="file"
            onChange={handleFileUpload}
            className="file-input"
          />
          <p>{fileSizeMB ? `File size: ${fileSizeMB} MB` : null}</p>{" "}
          {/* Display file size */}
          <input
            type="text"
            placeholder="File Name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="input-field"
          />
          <input
            type="text"
            placeholder="File URL (Generate Automatically)"
            value={fileUrl}
            readOnly
            className="input-field"
          />
          <input
            type="number"
            placeholder="Price (in SOL)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-field"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= 1000) {
                setDescription(e.target.value);
              }
            }}
            className="textarea"
          />
          <p>{description.length}/1000</p> {/* Display character count */}
        </motion.div>

        {/* Upload and Payment Buttons */}
        {!loading ? (
          <>
            <motion.button className="upload-button" onClick={uploadToPinata}>
              Upload and Pay with Crypto
            </motion.button>
            <motion.button className="fiat-button" onClick={handleFiatPayment}>
              Pay with Fiat
            </motion.button>
          </>
        ) : (
          <div className="loading-container">
            <Oval color="#007bff" height={50} width={50} />
            <p>{status}</p>
          </div>
        )}
      </div>

      {/* Status Message */}
      {!loading && status && (
        <div
          className={`status-message ${statusColor === "red" ? "error" : "success"}`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

export default HomePage;
