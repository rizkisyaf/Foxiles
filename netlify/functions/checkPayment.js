import WebSocket from 'ws';

export async function handler(event, context) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://foxiles.xyz');

    ws.on('open', () => {
      // Parsing incoming request data
      const { receiver, amount, memo } = JSON.parse(event.body);

      ws.send(JSON.stringify({ receiver, amount, memo }));
    });

    ws.on('message', (data) => {
      // Convert data to a string before parsing
      const responseString = data.toString();
      const response = JSON.parse(responseString);
      
      if (response.status === 'success') {
        resolve({
          statusCode: 200,
          body: JSON.stringify({ message: 'Payment found', signature: response.signature })
        });
      } else if (response.status === 'not_found') {
        resolve({
          statusCode: 404,
          body: JSON.stringify({ message: 'Payment not found' })
        });
      } else {
        resolve({
          statusCode: 500,
          body: JSON.stringify({ message: 'Error', error: response.message })
        });
      }
      ws.close();
    });

    ws.on('error', (error) => {
      reject({
        statusCode: 500,
        body: JSON.stringify({ message: 'WebSocket Error', error: error.message })
      });
    });
  });
}
