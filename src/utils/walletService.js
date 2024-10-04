// utils/walletService.js
import { PublicKey } from "@solana/web3.js";

// Connect to wallet and request accounts
export const connectWallet = async (provider) => {
  if (!provider) {
    throw new Error("Provider is not initialized.");
  }

  const accounts = await provider.requestAccounts();
  const walletPublicKey = new PublicKey(accounts[0]);
  return walletPublicKey;
};

// Disconnect wallet
export const disconnectWallet = () => {
  return null;
};
