/**
 * Web3 Auto-Payment Service — BNB / BEP20 on BSC
 * 
 * This module handles automatic BNB payments to workers via Binance Smart Chain.
 * It supports both BNB native transfers and USDT/BUSD BEP20 token transfers.
 */

const { ethers } = require('ethers');
const { getPool } = require('../db');

// BSC Mainnet config
const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const BSC_RPC_FALLBACKS = [
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
];
const BSC_CHAIN_ID = 56;
const BSC_EXPLORER = 'https://bscscan.com';

// BSC Testnet config (for testing)
const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const BSC_TESTNET_CHAIN_ID = 97;
const BSC_TESTNET_EXPLORER = 'https://testnet.bscscan.com';

// BEP20 Token Addresses (Mainnet)
const TOKEN_ADDRESSES = {
  USDT: '0x55d398326f99059fF775485246999027B3197955', // BSC USDT
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BSC BUSD
};

// Minimal ERC20 ABI for transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

/**
 * Get Web3 payment settings from DB
 */
async function getPaymentSettings() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value FROM site_settings 
     WHERE setting_key IN (
       'web3_enabled', 'web3_network', 'web3_private_key',
       'web3_hot_wallet', 'web3_pay_token', 'web3_vnd_rate',
       'web3_auto_approve', 'web3_min_amount', 'web3_gas_limit'
     )`
  );
  const config = {};
  rows.forEach(r => { config[r.setting_key] = r.setting_value; });
  return config;
}

/**
 * Get provider based on network setting
 */
function getProvider(network = 'mainnet') {
  const rpc = network === 'testnet' ? BSC_TESTNET_RPC : BSC_RPC;
  return new ethers.JsonRpcProvider(rpc, {
    name: network === 'testnet' ? 'bnbt' : 'bnb',
    chainId: network === 'testnet' ? BSC_TESTNET_CHAIN_ID : BSC_CHAIN_ID,
  });
}

/**
 * Get wallet signer
 */
function getWallet(privateKey, network = 'mainnet') {
  const provider = getProvider(network);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get hot wallet BNB balance
 */
async function getHotWalletBalance(privateKey, network = 'mainnet') {
  const wallet = getWallet(privateKey, network);
  const balance = await wallet.provider.getBalance(wallet.address);
  return {
    address: wallet.address,
    balanceBNB: ethers.formatEther(balance),
    balanceWei: balance.toString(),
  };
}

/**
 * Get BEP20 token balance of hot wallet
 */
async function getTokenBalance(privateKey, tokenSymbol, network = 'mainnet') {
  const wallet = getWallet(privateKey, network);
  const tokenAddr = TOKEN_ADDRESSES[tokenSymbol];
  if (!tokenAddr) throw new Error(`Token ${tokenSymbol} not supported`);
  
  const contract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
  const balance = await contract.balanceOf(wallet.address);
  const decimals = await contract.decimals();
  return {
    balance: ethers.formatUnits(balance, decimals),
    balanceRaw: balance.toString(),
    decimals: Number(decimals),
  };
}

/**
 * Send BNB native transfer
 */
async function sendBNB(privateKey, toAddress, amountBNB, network = 'mainnet', gasLimit = 21000) {
  const wallet = getWallet(privateKey, network);
  
  // Validate address
  if (!ethers.isAddress(toAddress)) {
    throw new Error('Địa chỉ ví không hợp lệ');
  }
  
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amountBNB.toString()),
    gasLimit: BigInt(gasLimit),
  });
  
  // Wait for confirmation
  const receipt = await tx.wait(1);
  
  const explorer = network === 'testnet' ? BSC_TESTNET_EXPLORER : BSC_EXPLORER;
  
  return {
    txHash: receipt.hash,
    from: wallet.address,
    to: toAddress,
    amount: amountBNB,
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    explorerUrl: `${explorer}/tx/${receipt.hash}`,
    status: receipt.status === 1 ? 'success' : 'failed',
  };
}

/**
 * Send BEP20 token (USDT, BUSD)
 */
async function sendToken(privateKey, toAddress, amount, tokenSymbol, network = 'mainnet', gasLimit = 100000) {
  const wallet = getWallet(privateKey, network);
  const tokenAddr = TOKEN_ADDRESSES[tokenSymbol];
  if (!tokenAddr) throw new Error(`Token ${tokenSymbol} not supported`);
  
  if (!ethers.isAddress(toAddress)) {
    throw new Error('Địa chỉ ví không hợp lệ');
  }
  
  const contract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amountWei = ethers.parseUnits(amount.toString(), decimals);
  
  const tx = await contract.transfer(toAddress, amountWei, { gasLimit: BigInt(gasLimit) });
  const receipt = await tx.wait(1);
  
  const explorer = network === 'testnet' ? BSC_TESTNET_EXPLORER : BSC_EXPLORER;
  
  return {
    txHash: receipt.hash,
    from: wallet.address,
    to: toAddress,
    amount: amount,
    token: tokenSymbol,
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    explorerUrl: `${explorer}/tx/${receipt.hash}`,
    status: receipt.status === 1 ? 'success' : 'failed',
  };
}

/**
 * Convert VND amount to crypto amount based on rate
 * @param {number} vndAmount - Amount in VND
 * @param {string} token - 'BNB' or 'USDT' or 'BUSD'
 * @param {number|null} customRate - Custom VND rate (1 token = X VND), if null fetches from CoinGecko
 */
async function convertVndToCrypto(vndAmount, token = 'BNB', customRate = null) {
  let rate = customRate;
  
  if (!rate) {
    // Fetch from CoinGecko
    try {
      const coinId = token === 'BNB' ? 'binancecoin' : 'tether';
      const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=vnd`);
      const data = await resp.json();
      rate = data[coinId]?.vnd;
    } catch {
      // Fallback rates
      rate = token === 'BNB' ? 9500000 : 25500;
    }
  }
  
  const cryptoAmount = vndAmount / rate;
  return {
    vndAmount,
    cryptoAmount: Number(cryptoAmount.toFixed(token === 'BNB' ? 8 : 4)),
    rate,
    token,
  };
}

/**
 * Process auto-payment for a withdrawal
 * @param {number} txId - Transaction ID in the database
 * @returns {object} Payment result
 */
async function processAutoPayment(txId) {
  const pool = getPool();
  const config = await getPaymentSettings();
  
  if (config.web3_enabled !== 'true') {
    throw new Error('Web3 payment chưa được bật');
  }
  
  const privateKey = config.web3_private_key;
  if (!privateKey) {
    throw new Error('Chưa cấu hình private key hot wallet');
  }
  
  const network = config.web3_network || 'mainnet';
  const payToken = config.web3_pay_token || 'BNB';
  const gasLimit = parseInt(config.web3_gas_limit) || (payToken === 'BNB' ? 21000 : 100000);
  
  // Get transaction details
  const [txs] = await pool.execute(
    'SELECT t.*, u.name as user_name, u.email as user_email FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?',
    [txId]
  );
  if (!txs[0]) throw new Error('Transaction not found');
  const tx = txs[0];
  
  if (tx.status !== 'pending') throw new Error('Transaction đã được xử lý');
  if (tx.type !== 'withdraw') throw new Error('Không phải yêu cầu rút tiền');
  
  // Parse crypto address from note
  // Format: "[Crypto] USDT (BEP20) - 0x123..." or "[Bank] ..."
  const note = tx.note || '';
  const cryptoMatch = note.match(/\[Crypto\]\s*[^-]*-\s*(0x[a-fA-F0-9]{40})/);
  if (!cryptoMatch) {
    throw new Error('Không tìm thấy địa chỉ ví crypto trong yêu cầu');
  }
  
  const toAddress = cryptoMatch[1];
  
  // Convert VND to crypto
  const customRate = config.web3_vnd_rate ? parseFloat(config.web3_vnd_rate) : null;
  const conversion = await convertVndToCrypto(tx.amount, payToken, customRate);
  
  // Execute payment
  let payResult;
  if (payToken === 'BNB') {
    payResult = await sendBNB(privateKey, toAddress, conversion.cryptoAmount, network, gasLimit);
  } else {
    payResult = await sendToken(privateKey, toAddress, conversion.cryptoAmount, payToken, network, gasLimit);
  }
  
  // Update transaction in DB
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    await conn.execute(
      `UPDATE transactions SET status = 'completed',
       note = CONCAT(note, ' | TxHash: ', ?, ' | Amount: ', ?, ' ', ?, ' | Rate: 1 ', ?, ' = ', ?, ' VND')
       WHERE id = ?`,
      [payResult.txHash, conversion.cryptoAmount, payToken, payToken, conversion.rate, txId]
    );
    
    // Save payment detail to web3_payments table
    await conn.execute(
      `INSERT INTO web3_payments (transaction_id, user_id, tx_hash, from_address, to_address,
        amount_vnd, amount_crypto, token, network, gas_used, block_number, explorer_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, tx.user_id, payResult.txHash, payResult.from, toAddress,
       tx.amount, conversion.cryptoAmount, payToken, network,
       payResult.gasUsed, payResult.blockNumber, payResult.explorerUrl, payResult.status]
    );
    
    // Notify worker
    const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id,
       '✅ Thanh toán BNB thành công',
       `Yêu cầu rút ${fmtAmount} đ đã được thanh toán: ${conversion.cryptoAmount} ${payToken}. TxHash: ${payResult.txHash}`,
       'success', 'worker']
    );
    
    await conn.commit();
    conn.release();
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
  
  return {
    ...payResult,
    conversion,
    transactionId: txId,
  };
}

module.exports = {
  getPaymentSettings,
  getProvider,
  getHotWalletBalance,
  getTokenBalance,
  sendBNB,
  sendToken,
  convertVndToCrypto,
  processAutoPayment,
  BSC_EXPLORER,
  BSC_TESTNET_EXPLORER,
  TOKEN_ADDRESSES,
};
