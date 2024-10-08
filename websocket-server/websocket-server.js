// websocket-server.js
const { Server } = require("socket.io");
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
require("dotenv").config();

// Validate and assign RPC URL
const rpcUrl = process.env.REACT_APP_RPC_URL;

if (!rpcUrl) {
  throw new Error("Missing RPC URL. Set REACT_APP_RPC_URL in your environment.");
}

const connection = new Connection(rpcUrl, "confirmed");

// Initialize Socket.IO server
const io = new Server(8080, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("New client connected");

  // Handle incoming payment requests
  socket.on("checkPayment", async ({ receiver, amount, memo }) => {
    try {
      if (!receiver || !amount || !memo) {
        socket.emit("paymentError", { message: "Invalid input data." });
        return;
      }

      const receiverPublicKey = new PublicKey(receiver);

      // Fetching transaction signatures related to the receiver
      const signatures = await connection.getSignaturesForAddress(receiverPublicKey, { limit: 20 });

      let foundTransaction = null;

      for (let signature of signatures) {
        const transaction = await connection.getParsedTransaction(signature.signature);
        if (!transaction) continue;

        // Find and check instructions in transaction
        for (let instruction of transaction.transaction.message.instructions) {
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
        socket.emit("paymentSuccess", { signature: foundTransaction });
      } else {
        socket.emit("paymentNotFound");
      }
    } catch (error) {
      socket.emit("paymentError", { message: error.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

console.log("Socket.IO server running on ws://localhost:8080");
