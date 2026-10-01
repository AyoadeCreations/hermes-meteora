'use client';

/**
 * WalletProvider
 *
 * autoConnect=false fixes SSR hydration mismatch.
 * Reconnect is handled by the WalletMultiButton modal.
 */

import React, { useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter }  from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';

const ENV_NETWORK  = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
const ENV_RPC_DEV  = process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET;
const ENV_RPC_MAIN = process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET;

function getNetwork(): WalletAdapterNetwork {
  return ENV_NETWORK === 'mainnet-beta'
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet;
}

function getEndpoint(network: WalletAdapterNetwork): string {
  return network === WalletAdapterNetwork.Mainnet
    ? (ENV_RPC_MAIN ?? clusterApiUrl('mainnet-beta'))
    : (ENV_RPC_DEV  ?? clusterApiUrl('devnet'));
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const network  = getNetwork();
  const endpoint = useMemo(() => getEndpoint(network), [network]);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* autoConnect=false prevents SSR/hydration mismatch */}
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
