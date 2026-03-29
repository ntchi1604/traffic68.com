const { ethers } = require('ethers');
const { getPool } = require('../db');

const BSC_RPCS = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
];
let rpcIndex = 0;
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
  const rpc = BSC_RPCS[rpcIndex % BSC_RPCS.length];
  return new ethers.JsonRpcProvider(rpc, { name: 'bnb', chainId: BSC_CHAIN_ID });
}
function rotateRpc() {
  rpcIndex = (rpcIndex + 1) % BSC_RPCS.length;
  console.log(`[DepositWatcher] Rotated to RPC: ${BSC_RPCS[rpcIndex]}`);
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
       'deposit_trc20_enabled', 'deposit_trc20_address', 'deposit_trc20_auto',
       'web3_vnd_rate'
     )`
  );
  const config = {};
  rows.forEach(r => { config[r.setting_key] = r.setting_value; });
  return config;
}

let lastKnownBalance = { crypto: null, trc20: null };

async function getUSDTBalance(address) {
  const provider = getProvider();
  const usdt = new ethers.Contract(USDT_ADDRESS, [
    'function balanceOf(address) view returns (uint256)'
  ], provider);
  const bal = await usdt.balanceOf(address);
  return Number(ethers.formatUnits(bal, 18));
}

async function getTrc20USDTBalance(address) {
  if (!address) return 0;
  try {
    const resp = await fetch(`https://apilist.tronscanapi.com/api/accountinfo?address=${address}`);
    const data = await resp.json();
    const usdt = data.trc20token_balances?.find(t => t.tokenId === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    if (!usdt) return 0;
    return Number(usdt.balance) / 1e6;
  } catch (err) {
    console.error('[DepositWatcher] Error fetching TRC20 balance:', err.message);
    throw err;
  }
}

async function processIncomingDeposits() {
  const pool = getPool();
  const config = await getDepositSettings();

  const networks = [
    {
      id: 'crypto',
      enabled: config.deposit_crypto_enabled === 'true',
      auto: config.deposit_crypto_auto === 'true',
      address: config.deposit_crypto_address,
      getBalance: getUSDTBalance,
      label: 'BEP20'
    },
    {
      id: 'trc20',
      enabled: config.deposit_trc20_enabled === 'true',
      auto: config.deposit_trc20_auto === 'true',
      address: config.deposit_trc20_address,
      getBalance: getTrc20USDTBalance,
      label: 'TRC20'
    }
  ];

  for (const net of networks) {
    if (!net.enabled || !net.auto || !net.address) continue;

    const [pending] = await pool.execute(
      `SELECT * FROM transactions WHERE type='deposit' AND method=? AND status='pending' AND wallet_type='main' ORDER BY created_at ASC`,
      [net.id]
    );

    let currentBalance;
    try {
      currentBalance = await net.getBalance(net.address);
    } catch (err) {
      if (net.id === 'crypto') rotateRpc();
      continue;
    }

    if (pending.length > 0) {
      console.log(`[DepositWatcher] ${net.label}: ${pending.length} pending | Balance: ${currentBalance} USDT (prev: ${lastKnownBalance[net.id] ?? 'N/A'})`);
    }

    if (lastKnownBalance[net.id] === null) {
      lastKnownBalance[net.id] = currentBalance;
      if (pending.length > 0) console.log(`[DepositWatcher] ${net.label}: First run — recorded starting balance`);
      continue;
    }

    const delta = currentBalance - lastKnownBalance[net.id];
    if (delta <= 0) continue;

    console.log(`[DepositWatcher] ${net.label} Balance increased by ${delta.toFixed(4)} USDT!`);

    let bestMatch = null;
    let bestDiff = Infinity;
    for (const tx of pending) {
      const match = (tx.note || '').match(/Expected:\s*([\d.]+)\s*USDT/);
      if (!match) continue;
      const expectedUSDT = parseFloat(match[1]);
      const diff = Math.abs(delta - expectedUSDT);
      if (diff <= 0.05 && diff < bestDiff) {
        bestDiff = diff;
        bestMatch = { tx, expectedUSDT };
      }
    }

    if (!bestMatch) {
      console.log(`[DepositWatcher] ${net.label} No pending deposit matches delta ${delta.toFixed(4)} USDT`);
      lastKnownBalance[net.id] = currentBalance;
      continue;
    }

    const { tx } = bestMatch;
    console.log(`[DepositWatcher] MATCHED Tx ${tx.id}: expected=${bestMatch.expectedUSDT} delta=${delta.toFixed(4)} diff=${bestDiff.toFixed(4)}`);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `UPDATE transactions SET status='completed', note=CONCAT(note, ' | Auto-confirmed | Received: ', ?, ' USDT') WHERE id=? AND status='pending'`,
        [delta.toFixed(4), tx.id]
      );
      await conn.execute('UPDATE wallets SET balance=balance+? WHERE user_id=? AND type=?', [tx.amount, tx.user_id, 'main']);
      const fmtAmount = new Intl.NumberFormat('vi-VN').format(tx.amount);
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, role) VALUES (?, ?, ?, ?, ?)`,
        [tx.user_id, '✅ Nạp tiền thành công', `Đã nhận ${delta.toFixed(4)} USDT (${net.label}) và cộng ${fmtAmount} VNĐ vào Ví Traffic.`, 'success', 'buyer']
      );
      await conn.commit();
      console.log(`[DepositWatcher] ✅ Credited ${fmtAmount} VND to user ${tx.user_id}`);
    } catch (err) {
      await conn.rollback();
      console.error('[DepositWatcher] DB error:', err.message);
    } finally {
      conn.release();
    }
    lastKnownBalance[net.id] = currentBalance;
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

function resetDepositScanner(lookbackBlocks = 10000) {
  lastCheckedBlock = 0;
  console.log(`[DepositWatcher] Scanner reset — will re-scan last ${lookbackBlocks} blocks on next poll`);
}

module.exports = {
  getPaymentSettings,
  getHotWalletInfo,
  sendUSDT,
  convertVndToUSDT,
  processAutoPayment,
  BSC_EXPLORER,
  getDepositSettings,
  processIncomingDeposits,
  startDepositWatcher,
  stopDepositWatcher,
  resetDepositScanner,
};
