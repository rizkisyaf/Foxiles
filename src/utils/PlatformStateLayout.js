import { struct, Layout } from '@solana/buffer-layout';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer'; // Ensure Buffer is available

// Custom layout for PublicKey (32 bytes)
class PublicKeyLayout extends Layout {
  constructor(property) {
    super(32, property);
  }

  decode(buffer, offset) {
    return new PublicKey(buffer.slice(offset, offset + 32)); // Decode as PublicKey
  }

  encode(publicKey, buffer, offset) {
    const pubKeyBuffer = publicKey.toBuffer();
    pubKeyBuffer.copy(buffer, offset);
    return this.span;
  }

  getSpan() {
    return 32; // PublicKey is always 32 bytes
  }
}

// Define the layout for the PlatformState struct with explicit PublicKey type
export const PlatformStateLayout = struct([
  new PublicKeyLayout('owner'),               // The owner public key
  new PublicKeyLayout('platform_fee_account') // The platform fee account public key
]);

// Function to deserialize the platform state
export function deserializePlatformState(buffer) {
  const decodedData = PlatformStateLayout.decode(buffer);
  return {
    owner: decodedData.owner,  // Return as PublicKey
    platform_fee_account: decodedData.platform_fee_account, // Return as PublicKey
  };
}

// Function to serialize the platform state
export function serializePlatformState(platformState) {
  const buffer = Buffer.alloc(PlatformStateLayout.span);
  PlatformStateLayout.encode({
    owner: platformState.owner,  // Pass PublicKey directly
    platform_fee_account: platformState.platform_fee_account,  // Pass PublicKey directly
  }, buffer);
  return buffer;
}
