import { PinataSDK } from "pinata-web3";
import { Connection } from "@solana/web3.js";

export const pinata = new PinataSDK({
  pinataJwt: `${process.env.REACT_APP_PINATA_JWT}`,
  pinataGateway: `${process.env.REACT_APP_PINATA_GATEWAY_URL}`
});

export const connection = new Connection("https://api.devnet.solana.com", "confirmed");
