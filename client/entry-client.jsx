import { StrictMode, Suspense } from "react";
import ReactDOM from "react-dom/client";
//import App from "./components/App";
//import App2 from "./components/App2.jsx";
//import RealTimeSpeechToText from "./components/RealTimeSpeechToText.jsx";
//import Recorder from "./components/Recorder";
import ConnectionWs from "./components/ConnectionWs.jsx";
import "./base.css";

ReactDOM.hydrateRoot(
  document.getElementById("root"),
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <ConnectionWs />
    </Suspense>
  </StrictMode>,
);
