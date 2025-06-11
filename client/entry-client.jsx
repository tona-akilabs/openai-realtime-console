import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import App2 from "./components/App2.jsx";
import "./base.css";

ReactDOM.hydrateRoot(
  document.getElementById("root"),
  <StrictMode>
    <App />
  </StrictMode>,
);
