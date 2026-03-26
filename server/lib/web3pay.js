/**
 * Web3 Auto-Payment Service — USDT BEP20 on BSC Mainnet
 */

const { ethers } = require('ethers');
const { getPool } = require('../db');

// BSC Mainnet only
const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const BSC_CHAIN_ID = 56;
const BSC_EXPLORER = 'https://bscscan.com';

// USDT BEP20 on BSC Mainnet
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

// Minimal ERC20 ABI
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

async function getPaymentSettings() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value FROM site_settings 
     WHERE setting_key IN (
       'web3_enabled', 'web3_private_key',
       'web3_vnd_rate', 'web3_auto_approve', 'web3_gas_limit'
     )`
  );
  const config = {};
  rows.forEach(r => { config[r.setting_key] = r.setting_value; });
  return config;
}

function getProvider() {
  return new ethers.JsonRpcProvider(BSC_RPC, { name: 'bnb', chainId: BSC_CHAIN_ID });
}

function getWallet(privateKey) {
  return new ethers.Wallet(privateKey, getProvider());
}

async function getHotWalletInfo(privateKey) {
  const wallet = getWallet(privateKey);
  const bnbBalance = await wallet.provider.getBalance(wallet.address);
  const contract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet);
  const usdtBalance = await contract.balanceOf(wallet.address);
  const decimals = await contract.decimals();
  return {
    address: wallet.address,
    bnbBalance: ethers.formatEther(bnbBalance),
    usdtBalance: ethers.formatUnits(usdtBalance, decimals),
  };
}

async function sendUSDT(privateKey, toAddress, amount, gasLimit = 100000) {
  const wallet = getWallet(privateKey);
  if (!ethers.isAddress(toAddress)) throw new Error('Địa chỉ ví không hợp lệ');

  const contract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amountWei = ethers.parseUnits(amount.toString(), decimals);

  const tx = await contract.transfer(toAddress, amountWei, { gasLimit: BigInt(gasLimit) });
  const receipt = await tx.wait(1);

  return {
    txHash: receipt.hash,
    from: wallet.address,
    to: toAddress,
    amount,
    token: 'USDT',
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    explorerUrl: `${BSC_EXPLORER}/tx/${receipt.hash}`,
    status: receipt.status === 1 ? 'success' : 'failed',
  };
}

async function convertVndToUSDT(vndAmount, customRate = null) {
  let rate = customRate;
  if (!rate) {
    try {
      const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd');
      const data = await resp.json();
      rate = data.tether?.vnd;
    } catch {
      rate = 25500;
    }
  }
  return {
    vndAmount,
    usdtAmount: Number((vndAmount / rate).toFixed(4)),
    rate,
  };
}

async function processAutoPayment(txId) {
  const pool = getPool();
  const config = await getPaymentSettings();

  if (config.web3_enabled !== 'true') throw new Error('Web3 payment chưa được bật');
  const privateKey = config.web3_private_key;
  if (!privateKey) throw new Error('Chưa cấu hình private key hot wallet');

  const gasLimit = parseInt(config.web3_gas_limit) || 100000;

  const [txs] = await pool.execute(
    'SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?',
    [txId]
  );
  if (!txs[0]) throw new Error('Transaction not found');
  const tx = txs[0];

  if (tx.status !== 'pending') throw new Error('Transaction đã được xử lý');
  if (tx.type !== 'withdraw') throw new Error('Không phải yêu cầu rút tiền');

  const cryptoMatch = (tx.note || '').match(/\[Crypto\]\s*[^-]*-\s*(0x[a-fA-F0-9]{40})/);
  if (!cryptoMatch) throw new Error('Không tìm thấy địa chỉ ví crypto');

  const toAddress = cryptoMatch[1];
  const customRate = config.web3_vnd_rate ? parseFloat(config.web3_vnd_rate) : null;
  const conversion = await convertVndToUSDT(tx.amount, customRate);
  const payResult = await sendUSDT(privateKey, toAddress, conversion.usdtAmount, gasLimit);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE transactions SET status = 'completed',
       note = CONCAT(note, ' | TxHash: ', ?, ' | Amount: ', ?, ' USDT | Rate: 1 USDT = ', ?, ' VND')
       WHERE id = ?`,
      [payResult.txHash, conversion.usdtAmount, conversion.rate, txId]
    );
    await conn.execute(
      `INSERT INTO web3_payments (transaction_id, user_id, tx_hash, from_address, to_address,
        amount_vnd, amount_crypto, token, network, gas_used, block_number, explorer_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'USDT', 'mainnet', ?, ?, ?, ?)`,
      [txId, tx.user_id, payResult.txHash, payResult.from, toAddress,
       tx.amount, conversion.usdtAmount,
       payResult.gasUsed, payResult.blockNumber, payResult.explorerUrl, payResult.status]
    );
    const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
      [tx.user_id, '✅ Thanh toán USDT thành công',
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

  return { ...payResult, conversion, transactionId: txId };
}

module.exports = {
  getPaymentSettings,
  getHotWalletInfo,
  sendUSDT,
  convertVndToUSDT,
  processAutoPayment,
  BSC_EXPLORER,
};
