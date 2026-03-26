/**
 * Web3 Auto-Payment Service — USDT BEP20 on BSC
 * 
 * This module handles automatic USDT (BEP20) payments to workers via Binance Smart Chain.
 */

const { ethers } = require('ethers');
const { getPool } = require('../db');

// BSC Mainnet config
const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const BSC_CHAIN_ID = 56;
const BSC_EXPLORER = 'https://bscscan.com';

// BSC Testnet config (for testing)
const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const BSC_TESTNET_CHAIN_ID = 97;
const BSC_TESTNET_EXPLORER = 'https://testnet.bscscan.com';

// USDT BEP20 on BSC Mainnet
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
// USDT BEP20 on BSC Testnet (mock)
const USDT_TESTNET_ADDRESS = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd';

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
       'web3_vnd_rate', 'web3_auto_approve', 'web3_gas_limit'
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
 * Get hot wallet info (BNB for gas + USDT balance)
 */
async function getHotWalletInfo(privateKey, network = 'mainnet') {
  const wallet = getWallet(privateKey, network);
  const bnbBalance = await wallet.provider.getBalance(wallet.address);
  
  const tokenAddr = network === 'testnet' ? USDT_TESTNET_ADDRESS : USDT_ADDRESS;
  const contract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
  const usdtBalance = await contract.balanceOf(wallet.address);
  const decimals = await contract.decimals();
  
  return {
    address: wallet.address,
    bnbBalance: ethers.formatEther(bnbBalance),
    usdtBalance: ethers.formatUnits(usdtBalance, decimals),
  };
}

/**
 * Send USDT BEP20
 */
async function sendUSDT(privateKey, toAddress, amount, network = 'mainnet', gasLimit = 100000) {
  const wallet = getWallet(privateKey, network);
  
  if (!ethers.isAddress(toAddress)) {
    throw new Error('Địa chỉ ví không hợp lệ');
  }
  
  const tokenAddr = network === 'testnet' ? USDT_TESTNET_ADDRESS : USDT_ADDRESS;
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
    token: 'USDT',
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    explorerUrl: `${explorer}/tx/${receipt.hash}`,
    status: receipt.status === 1 ? 'success' : 'failed',
  };
}

/**
 * Convert VND amount to USDT based on rate
 * @param {number} vndAmount - Amount in VND
 * @param {number|null} customRate - Custom VND rate (1 USDT = X VND), if null fetches from CoinGecko
 */
async function convertVndToUSDT(vndAmount, customRate = null) {
  let rate = customRate;
  
  if (!rate) {
    try {
      const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd');
      const data = await resp.json();
      rate = data.tether?.vnd;
    } catch {
      rate = 25500; // Fallback
    }
  }
  
  const usdtAmount = vndAmount / rate;
  return {
    vndAmount,
    usdtAmount: Number(usdtAmount.toFixed(4)),
    rate,
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
  const gasLimit = parseInt(config.web3_gas_limit) || 100000;
  
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
  const note = tx.note || '';
  const cryptoMatch = note.match(/\[Crypto\]\s*[^-]*-\s*(0x[a-fA-F0-9]{40})/);
  if (!cryptoMatch) {
    throw new Error('Không tìm thấy địa chỉ ví crypto trong yêu cầu');
  }
  
  const toAddress = cryptoMatch[1];
  
  // Convert VND to USDT
  const customRate = config.web3_vnd_rate ? parseFloat(config.web3_vnd_rate) : null;
  const conversion = await convertVndToUSDT(tx.amount, customRate);
  
  // Send USDT BEP20
  const payResult = await sendUSDT(privateKey, toAddress, conversion.usdtAmount, network, gasLimit);
  
  // Update transaction in DB
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    await conn.execute(
      `UPDATE transactions SET status = 'completed',
       note = CONCAT(note, ' | TxHash: ', ?, ' | Amount: ', ?, ' USDT | Rate: 1 USDT = ', ?, ' VND')
       WHERE id = ?`,
      [payResult.txHash, conversion.usdtAmount, conversion.rate, txId]
    );
    
    // Save payment detail to web3_payments table
    await conn.execute(
      `INSERT INTO web3_payments (transaction_id, user_id, tx_hash, from_address, to_address,
        amount_vnd, amount_crypto, token, network, gas_used, block_number, explorer_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, tx.user_id, payResult.txHash, payResult.from, toAddress,
       tx.amount, conversion.usdtAmount, 'USDT', network,
       payResult.gasUsed, payResult.blockNumber, payResult.explorerUrl, payResult.status]
    );
    
    // Notify worker
    const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id,
       '✅ Thanh toán USDT thành công',
       `Yêu cầu rút ${fmtAmount} đ đã được thanh toán: ${conversion.usdtAmount} USDT (BEP20). TxHash: ${payResult.txHash}`,
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
  getHotWalletInfo,
  sendUSDT,
  convertVndToUSDT,
  processAutoPayment,
  BSC_EXPLORER,
  BSC_TESTNET_EXPLORER,
};
