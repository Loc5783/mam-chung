import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App";
import { queryClient } from "./lib/queryClient";
import { getMotionPreference, setMotionPreference } from "./lib/motion";
import "./styles/global.css";
import "./styles/motion.css";

// Apply persisted motion preference on startup
setMotionPreference(getMotionPreference());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
