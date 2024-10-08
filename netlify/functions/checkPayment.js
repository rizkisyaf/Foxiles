import { io } from 'socket.io-client';

export async function handler(event, context) {
  return new Promise((resolve, reject) => {
    // Establish a connection to the Socket.IO server
    const socket = io('wss://ws.foxiles.xyz', {
      transports: ['websocket'], // Use WebSocket as the transport mechanism
    });

    socket.on('connect', () => {
      // Parsing incoming request data
      const { receiver, amount, memo } = JSON.parse(event.body);

      // Send payment details to the Socket.IO server
      socket.emit('checkPayment', { receiver, amount, memo });
    });

    // Handle payment success
    socket.on('paymentSuccess', (data) => {
      resolve({
        statusCode: 200,
        body: JSON.stringify({ message: 'Payment found', signature: data.signature })
      });
      socket.disconnect();
    });

    // Handle payment not found
    socket.on('paymentNotFound', () => {
      resolve({
        statusCode: 404,
        body: JSON.stringify({ message: 'Payment not found' })
      });
      socket.disconnect();
    });

    // Handle payment error
    socket.on('paymentError', (data) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ message: 'Error', error: data.message })
      });
      socket.disconnect();
    });

    // Handle connection error
    socket.on('connect_error', (error) => {
      reject({
        statusCode: 500,
        body: JSON.stringify({ message: 'WebSocket Error', error: error.message })
      });
      socket.disconnect();
    });
  });
}
