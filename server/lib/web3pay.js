const { ethers } = require('ethers');
const { getPool } = require('../db');

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
       'web3_enabled', 'web3_vnd_rate', 'web3_auto_approve', 'web3_gas_limit'
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

let cachedRate = null;
let lastRateFetchTime = 0;

async function convertVndToUSDT(vndAmount, customRate = null) {
  let rate = customRate ? parseFloat(customRate) : null;
  
  if (!rate || isNaN(rate)) {
    const now = Date.now();
    // Use cached rate if within 10 minutes (600,000 ms)
    if (cachedRate && now - lastRateFetchTime < 600000) {
      rate = cachedRate;
    } else {
      try {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd');
        const data = await resp.json();
        const fetchedRate = parseFloat(data.tether?.vnd);
        if (fetchedRate && !isNaN(fetchedRate)) {
          rate = fetchedRate;
          cachedRate = rate;
          lastRateFetchTime = now;
        } else {
          rate = cachedRate || 25500;
        }
      } catch {
        rate = cachedRate || 25500;
      }
    }
  }
  return {
    vndAmount,
    usdtAmount: Number((vndAmount / rate).toFixed(4)),
    rate,
  };
}

async function processAutoPayment(txId, privateKey) {
  const pool = getPool();
  const config = await getPaymentSettings();

  if (config.web3_enabled !== 'true') throw new Error('Web3 payment chưa được bật');
  if (!privateKey) throw new Error('Chưa cung cấp Private Key');

  const gasLimit = parseInt(config.web3_gas_limit) || 100000;

  const [txs] = await pool.execute(
    'SELECT t.*, u.name as user_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?',
    [txId]
  );
  if (!txs[0]) throw new Error('Transaction not found');
  const tx = txs[0];

  if (tx.status !== 'pending') throw new Error('Transaction đã được xử lý');
  if (tx.type !== 'withdraw') throw new Error('Không phải yêu cầu rút tiền');

  // Atomic lock: change status to 'processing' before talking to blockchain
  const [lockRes] = await pool.execute(
    "UPDATE transactions SET status = 'processing' WHERE id = ? AND status = 'pending'",
    [txId]
  );
  if (lockRes.affectedRows === 0) {
    throw new Error('Giao dịch đang được xử lý bởi một tiến trình khác hoặc đã hoàn tất!');
  }

  const cryptoMatch = (tx.note || '').match(/\[Crypto\]\s*[^-]*-\s*(0x[a-fA-F0-9]{40})/);
  if (!cryptoMatch) {
    await pool.execute("UPDATE transactions SET status = 'pending' WHERE id = ?", [txId]);
    throw new Error('Không tìm thấy địa chỉ ví crypto');
  }

  const toAddress = cryptoMatch[1];
  const customRate = config.web3_vnd_rate ? parseFloat(config.web3_vnd_rate) : null;
  let payResult;
  let conversion;

  try {
    conversion = await convertVndToUSDT(tx.amount, customRate);
    payResult = await sendUSDT(privateKey, toAddress, conversion.usdtAmount, gasLimit);
  } catch (error) {
    // Revert lock so it can be retried later
    await pool.execute("UPDATE transactions SET status = 'pending' WHERE id = ?", [txId]);
    throw error;
  }

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
      [tx.user_id, 'Thanh toán USDT thành công',
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

/* ────────────────────────────────────────────────
   DEPOSIT MONITORING — watch incoming USDT on BSC
   ──────────────────────────────────────────────── */

async function getDepositSettings() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value FROM site_settings
     WHERE setting_key IN (
       'deposit_crypto_enabled','deposit_crypto_address','deposit_crypto_auto',
       'deposit_crypto_min_usdt','deposit_bank_enabled','deposit_bank_name',
       'deposit_bank_account','deposit_bank_holder','deposit_bank_branch',
       'web3_vnd_rate'
     )`
  );
  const config = {};
  rows.forEach(r => { config[r.setting_key] = r.setting_value; });
  return config;
}

// Track last processed block to avoid re-scanning
let lastCheckedBlock = 0;

async function checkIncomingUSDT(depositAddress) {
  if (!depositAddress || !ethers.isAddress(depositAddress)) return [];

  const provider = getProvider();
  const currentBlock = await provider.getBlockNumber();

  // First run: start from 200 blocks ago (~10 mins on BSC)
  if (lastCheckedBlock === 0) lastCheckedBlock = currentBlock - 200;

  const fromBlock = lastCheckedBlock + 1;
  if (fromBlock > currentBlock) return [];

  // Max 1000 blocks per query (BSC limit)
  const toBlock = Math.min(currentBlock, fromBlock + 999);

  // Transfer(address indexed from, address indexed to, uint256 value)
  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  const toTopic = ethers.zeroPadValue(depositAddress.toLowerCase(), 32);

  try {
    const logs = await provider.getLogs({
      address: USDT_ADDRESS,
      topics: [transferTopic, null, toTopic],
      fromBlock,
      toBlock,
    });

    lastCheckedBlock = toBlock;

    return logs.map(log => {
      const fromAddr = ethers.getAddress('0x' + log.topics[1].slice(26));
      const value = BigInt(log.data);
      const usdtAmount = Number(ethers.formatUnits(value, 18)); // USDT BEP20 = 18 decimals
      return {
        txHash: log.transactionHash,
        from: fromAddr,
        to: depositAddress,
        usdtAmount,
        blockNumber: log.blockNumber,
        explorerUrl: `${BSC_EXPLORER}/tx/${log.transactionHash}`,
      };
    });
  } catch (err) {
    console.error('[DepositWatcher] Error checking logs:', err.message);
    return [];
  }
}

async function processIncomingDeposits() {
  const pool = getPool();
  const config = await getDepositSettings();

  if (config.deposit_crypto_enabled !== 'true' || config.deposit_crypto_auto !== 'true') return;
  if (!config.deposit_crypto_address) return;

  // Get pending crypto deposits
  const [pending] = await pool.execute(
    `SELECT * FROM transactions WHERE type = 'deposit' AND method = 'crypto' AND status = 'pending' AND wallet_type = 'main' ORDER BY created_at ASC`
  );
  if (pending.length === 0) return;

  // Check for incoming USDT transfers
  const transfers = await checkIncomingUSDT(config.deposit_crypto_address);
  if (transfers.length === 0) return;

  // Build a set of already-used tx hashes to avoid double-credit
  const usedHashes = new Set();
  const [existing] = await pool.execute(
    `SELECT note FROM transactions WHERE type = 'deposit' AND method = 'crypto' AND status = 'completed' AND wallet_type = 'main' AND note LIKE '%TxHash:%'`
  );
  existing.forEach(r => {
    const m = (r.note || '').match(/TxHash:\s*(0x[a-fA-F0-9]{64})/);
    if (m) usedHashes.add(m[1].toLowerCase());
  });

  for (const tx of pending) {
    // Extract expected USDT from note: [Crypto Deposit] Expected: X.XXXX USDT
    const match = (tx.note || '').match(/Expected:\s*([\d.]+)\s*USDT/);
    if (!match) continue;
    const expectedUSDT = parseFloat(match[1]);

    // Find a matching transfer (±2% tolerance)
    const matched = transfers.find(t => {
      if (usedHashes.has(t.txHash.toLowerCase())) return false;
      const diff = Math.abs(t.usdtAmount - expectedUSDT);
      return diff / expectedUSDT < 0.02; // 2% tolerance
    });

    if (!matched) continue;
    usedHashes.add(matched.txHash.toLowerCase());

    // Auto-approve this deposit
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Mark transaction as completed
      await conn.execute(
        `UPDATE transactions SET status = 'completed',
         note = CONCAT(note, ' | Confirmed | TxHash: ', ?, ' | Received: ', ?, ' USDT | Block: ', ?)
         WHERE id = ? AND status = 'pending'`,
        [matched.txHash, matched.usdtAmount, matched.blockNumber, tx.id]
      );

      // Credit buyer's main wallet
      await conn.execute(
        'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND type = ?',
        [tx.amount, tx.user_id, 'main']
      );

      // Notify buyer
      const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [tx.user_id, '✅ Nạp tiền Crypto thành công',
          `Đã nhận ${matched.usdtAmount.toFixed(4)} USDT → +${fmtAmount} VNĐ vào Ví Traffic. TxHash: ${matched.txHash}`,
          'success', 'buyer']
      );

      await conn.commit();
      conn.release();
      console.log(`[DepositWatcher] Auto-credited ${tx.amount} VND to user ${tx.user_id} (TxHash: ${matched.txHash})`);
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('[DepositWatcher] Error processing deposit:', err.message);
    }
  }
}

let depositWatcherInterval = null;

function startDepositWatcher(intervalMs = 30000) {
  if (depositWatcherInterval) return;
  console.log('[DepositWatcher] Started — polling every', intervalMs / 1000, 's');
  depositWatcherInterval = setInterval(async () => {
    try { await processIncomingDeposits(); } catch (e) {
      console.error('[DepositWatcher] Poll error:', e.message);
    }
  }, intervalMs);
  // Run once immediately
  processIncomingDeposits().catch(e => console.error('[DepositWatcher] Initial poll error:', e.message));
}

function stopDepositWatcher() {
  if (depositWatcherInterval) { clearInterval(depositWatcherInterval); depositWatcherInterval = null; }
}

module.exports = {
  getPaymentSettings,
  getHotWalletInfo,
  sendUSDT,
  convertVndToUSDT,
  processAutoPayment,
  BSC_EXPLORER,
  getDepositSettings,
  checkIncomingUSDT,
  processIncomingDeposits,
  startDepositWatcher,
  stopDepositWatcher,
};
