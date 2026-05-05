"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi-config";
import { Toaster } from "sonner";
import { PriceProvider } from "@/components/PriceProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#FFD208",
            accentColorForeground: "#0A0A0A",
            borderRadius: "none",
            fontStack: "system",
            overlayBlur: "small",
          })}
          modalSize="compact"
        >
          <PriceProvider>{children}</PriceProvider>
          <Toaster
            position="top-right"
            offset={100}
            theme="light"
            toastOptions={{
              unstyled: false,
              classNames: {
                toast: "fhem-toast",
                title: "fhem-toast-title",
                description: "fhem-toast-desc",
                actionButton: "fhem-toast-action",
                cancelButton: "fhem-toast-cancel",
                closeButton: "fhem-toast-close",
                loader: "fhem-toast-loader",
                success: "fhem-toast-success",
                error: "fhem-toast-error",
                info: "fhem-toast-info",
                warning: "fhem-toast-warning",
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
