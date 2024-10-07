// websocket-server.js
const WebSocket = require('ws');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config();

// Validate and assign RPC URL
const rpcUrl = process.env.REACT_APP_RPC_URL;

if (!rpcUrl) {
  throw new Error("Missing RPC URL. Set REACT_APP_RPC_URL in your environment.");
}

const connection = new Connection(rpcUrl, "confirmed");

// Initialize WebSocket server
const wss = new WebSocket.Server({ port: 8080 }); // Replace port if necessary

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', async (rawMessage) => {
    try {
      // Convert the raw message to string
      const message = rawMessage.toString();

      const { receiver, amount, memo } = JSON.parse(message);

      if (!receiver || !amount || !memo) {
        ws.send(JSON.stringify({ status: "error", message: "Invalid input data." }));
        return;
      }

      const receiverPublicKey = new PublicKey(receiver);

      // Fetching transaction signatures related to the receiver
      const signatures = await connection.getConfirmedSignaturesForAddress2(receiverPublicKey, { limit: 20 });

      let foundTransaction = null;

      for (let signature of signatures) {
        const transaction = await connection.getParsedConfirmedTransaction(signature.signature);
        if (!transaction) continue;

        // Find and check instructions in transaction
        for (let instruction of transaction.transaction.message.instructions) {
          // Ensure instruction is of type ParsedInstruction
          if ('parsed' in instruction && instruction.programId.toString() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
            const parsedInstruction = instruction;

            if (parsedInstruction.parsed && parsedInstruction.parsed.type === "transfer") {
              const decodedMemo = parsedInstruction.parsed.info.memo || "";

              if (decodedMemo === memo && parsedInstruction.parsed.info.amount === (amount * LAMPORTS_PER_SOL).toString()) {
                foundTransaction = signature.signature;
                break;
              }
            }
          }
        }
        if (foundTransaction) break;
      }

      if (foundTransaction) {
        ws.send(JSON.stringify({ status: "success", signature: foundTransaction }));
      } else {
        ws.send(JSON.stringify({ status: "not_found" }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ status: "error", message: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server running on ws://localhost:8080');
