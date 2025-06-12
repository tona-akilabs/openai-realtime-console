import { useEffect, useState } from "react";
import { io } from "socket.io-client";

let socket;

export default function Connection() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    socket = io('http://localhost:8080');

    socket.on('connect', () => {
      console.warn('Socket connected with id:', socket.id);
      setIsConnected(true);
    });
    socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err);
      setIsConnected(false);
    })
    socket.on('disconnect', (reason) => {
      console.info('Socket disconnected:', reason);
      setIsConnected(false);
    });
  }, [])

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4 p-4">
      <h4 className="text-green-500 font-bold text-2xl">Realtime Connection Status</h4>
      <p>
        Status: {isConnected ? (
        <span className="text-green-500 font-semibold">Connected</span>
      ) : (
        <span className="text-red-500 font-semibold">Disconnected</span>
      )}
      </p>
      {!isConnected && <p className="text-sm text-yellow-600">Attempting to connect to server...</p>}
    </div>
  )
}