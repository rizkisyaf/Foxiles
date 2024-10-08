import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export async function handler(event, context) {
  try {
    const { receiver, amount, memo, signature } = JSON.parse(event.body);

    if (!signature) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Transaction signature is required" }),
      };
    }

    const connection = new Connection("https://api.devnet.solana.com");

    // Fetch the transaction using the signature
    const transactionDetails = await connection.getParsedTransaction(
      signature,
      {
        commitment: "finalized",
      }
    );

    if (!transactionDetails) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Transaction not found" }),
      };
    }

    // Verify transaction details
    const instructions = transactionDetails.transaction.message.instructions;
    let paymentVerified = false;

    for (const instruction of instructions) {
      // Check if the instruction is of type `ParsedInstruction`
      if ("parsed" in instruction) {
        const parsedInfo = instruction.parsed.info;

        if (
          parsedInfo.destination === receiver &&
          parseFloat(parsedInfo.lamports) ===
            parseFloat(amount) * LAMPORTS_PER_SOL &&
          parsedInfo.memo === memo
        ) {
          paymentVerified = true;
          break;
        }
      }
    }

    if (paymentVerified) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Payment verified", signature }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Payment details do not match" }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error", error: error.message }),
    };
  }
}
