import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    clusterApiUrl,
  } from "@solana/web3.js";
  import { serializePlatformState } from "./PlatformStateLayout";
  
  export const initializePlatformState = async () => {
    try {
      const existingPlatformStatePublicKey = localStorage.getItem(
        "platformStatePublicKey"
      );
  
      if (existingPlatformStatePublicKey) {
        console.log("Platform state already initialized.");
        return new PublicKey(existingPlatformStatePublicKey);
      }
  
      const ownerKeyString = process.env.REACT_APP_OWNER_KEY || "[]";
      const programIdString = process.env.REACT_APP_PROGRAM_ID || "";
  
      if (!ownerKeyString || !programIdString) {
        throw new Error(
          "Missing environment variables: REACT_APP_OWNER_KEY or REACT_APP_PROGRAM_ID"
        );
      }
  
      const ownerKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(ownerKeyString))
      );
      const connection = new Connection(clusterApiUrl("devnet"));
      const programID = new PublicKey(programIdString);
  
      const platformStateAccount = Keypair.generate();
      const platformState = {
        owner: ownerKeypair.publicKey,
        platform_fee_account: ownerKeypair.publicKey,
      };
  
      const serializedPlatformState = serializePlatformState(platformState);
      const lamports = await connection.getMinimumBalanceForRentExemption(
        serializedPlatformState.length
      );
  
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: ownerKeypair.publicKey,
          newAccountPubkey: platformStateAccount.publicKey,
          lamports,
          space: serializedPlatformState.length,
          programId: programID,
        }),
        {
          keys: [
            {
              pubkey: platformStateAccount.publicKey,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: ownerKeypair.publicKey,
              isSigner: true,
              isWritable: false,
            },
            {
              pubkey: ownerKeypair.publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: programID,
          data: Buffer.concat([Buffer.from([0]), serializedPlatformState]),
        }
      );
  
      await sendAndConfirmTransaction(connection, transaction, [
        ownerKeypair,
        platformStateAccount,
      ]);
  
      console.log(
        "Platform state initialized with public key:",
        platformStateAccount.publicKey.toBase58()
      );
  
      localStorage.setItem(
        "platformStatePublicKey",
        platformStateAccount.publicKey.toBase58()
      );
      localStorage.setItem("platformStateInitialized", "true");
  
      return platformStateAccount.publicKey;
    } catch (error) {
      console.error("Error initializing platform state:", error);
      throw error;
    }
  };
  