import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { FirnProvider } from "@/lib/firn-context";
import { router } from "./router";
import "./styles.css";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } },
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <FirnProvider>
        <RouterProvider router={router} />
      </FirnProvider>
    </QueryClientProvider>
  </StrictMode>,
);
