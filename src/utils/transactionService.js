// utils/transactionService.js
import { Transaction, SystemProgram } from "@solana/web3.js";

// Create a Solana transaction to transfer tokens
export const createTransferTransaction = async (
  connection,
  fromPubkey,
  toPubkey,
  lamports
) => {
  const transaction = new Transaction();
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  transaction.add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports,
    })
  );

  return transaction;
};
