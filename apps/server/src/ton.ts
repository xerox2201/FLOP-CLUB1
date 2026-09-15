import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Address, toNano, fromNano } from '@ton/core';
import { getHttpEndpoint } from '@orbs-network/ton-access';

const TON_NETWORK = (process.env.TON_NETWORK || 'testnet') as 'mainnet' | 'testnet';
const TON_API_KEY = process.env.TON_API_KEY || '';
const TON_HOT_MNEMONIC = process.env.TON_HOT_WALLET_MNEMONIC || '';
const TON_MIN_DEPOSIT = Number(process.env.TON_MIN_DEPOSIT || 0.5);

export class TonAdapter {
  private client: TonClient | null = null;
  private wallet: any = null;
  private walletAddress: string | null = null;

  async init(): Promise<void> {
    // 🔴 Resolve endpoint via ton-access
    try {
      const endpoint = await getHttpEndpoint({
        network: TON_NETWORK,
        ...(TON_API_KEY ? { apikey: TON_API_KEY } : {}),
      });
      console.log(`[ton] using endpoint: ${endpoint}`);

      this.client = new TonClient({ endpoint });
    } catch (e: any) {
      console.error('[ton] endpoint resolution failed:', e.message);
      // Fallback to toncenter
      const fallback = TON_NETWORK === 'mainnet'
        ? 'https://toncenter.com/api/v2/jsonRPC'
        : 'https://testnet.toncenter.com/api/v2/jsonRPC';
      console.warn(`[ton] falling back to ${fallback}`);
      this.client = new TonClient({
        endpoint: fallback,
        ...(TON_API_KEY ? { apiKey: TON_API_KEY } : {}),
      });
    }

    // 🔴 Load hot wallet
    if (!TON_HOT_MNEMONIC) {
      console.warn('[ton] no hot wallet mnemonic — withdrawals disabled');
      return;
    }

    try {
      const words = TON_HOT_MNEMONIC.trim().split(/\s+/);
      const key = await mnemonicToPrivateKey(words);
      const wallet = WalletContractV4.create({
        publicKey: key.publicKey,
        workchain: 0,
      });
      this.wallet = { contract: wallet, key };
      this.walletAddress = wallet.address.toString({
        bounceable: false,
        testOnly: TON_NETWORK !== 'mainnet',
      });
      console.log(`[ton] hot wallet: ${this.walletAddress}`);
    } catch (e: any) {
      console.error('[ton] hot wallet init failed:', e.message);
    }
  }

  getHotWalletAddress(): string | null {
    return this.walletAddress;
  }

  async sendTon(toAddress: string, amountTon: number, memo?: string): Promise<string> {
    if (!this.wallet) throw new Error('hot_wallet_not_initialized');
    if (!this.client) throw new Error('client_not_initialized');

    const contract = this.client.open(this.wallet.contract);
    const seqno = await contract.getSeqno();

    const transfer = await contract.createTransfer({
      seqno,
      secretKey: this.wallet.key.secretKey,
      messages: [
        internal({
          to: Address.parse(toAddress),
          value: toNano(amountTon.toString()),
          bounce: false,
          body: memo || '',
        }),
      ],
    });

    await contract.send(transfer);
    return transfer.hash().toString('hex');
  }

  async getBalance(address: string): Promise<number> {
    if (!this.client) return 0;
    try {
      const balance = await this.client.getBalance(Address.parse(address));
      return Number(fromNano(balance));
    } catch (e: any) {
      console.error('[ton] getBalance failed:', e.message);
      return 0;
    }
  }

  getMinDeposit(): number {
    return TON_MIN_DEPOSIT;
  }

  isReady(): boolean {
    return !!this.wallet && !!this.client;
  }
}

export const tonAdapter = new TonAdapter();