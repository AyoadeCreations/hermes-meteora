/** Solscan links. The cluster query goes AFTER the path, or the link does not open. */
export type ExplorerKind = 'account' | 'tx' | 'token';

export function explorerUrl(kind: ExplorerKind, value: string, network: string = 'devnet'): string {
  const base = `https://solscan.io/${kind}/${encodeURIComponent(value)}`;
  return network === 'mainnet-beta' ? base : `${base}?cluster=devnet`;
}
