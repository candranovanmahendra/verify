import clientPromise from '../../lib/mongodb';
import { isVpn } from "../../lib/isVpn";

const BOT_API = 'https://verify-three-rosy.vercel.app/verify'; // optional jika perlu
const SECRET_KEY = process.env.SECRET_KEY;

export default async function handler(req, res) {
  const { token } = req.query;
  const { fingerprint } = req.body || {};
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (req.method !== 'POST') {
    return res.status(405).json({ message: '❌ Metode tidak diizinkan. Gunakan POST.' });
  }

  if (!token) {
    return res.status(400).json({ message: '❌ Token tidak ditemukan.' });
  }

  if (!fingerprint) {
    return res.status(400).json({ message: '❌ Fingerprint tidak ditemukan.' });
  }

  try {
    const isUsingVpn = await isVpn(ip);
    if (isUsingVpn) {
      return res.json({ message: '🚫 VPN/Proxy terdeteksi. Silakan nonaktifkan VPN dan coba lagi.' });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const tokens = db.collection('referral_tokens');

    const tokenData = await tokens.findOne({ token });

    if (!tokenData) {
      return res.json({ message: '❌ Token tidak valid.' });
    }

    // ✅ Jika sudah valid, tidak perlu proses ulang
    if (tokenData.valid === true) {
      return res.json({ message: '✅ Verifikasi sudah dilakukan. Klik konfirmasi di bot.' });
    }

    // ❌ Blokir jika fingerprint atau IP sudah pernah dipakai
    const sameIpUsed = await tokens.findOne({ ip, used: true });
    const sameFpUsed = await tokens.findOne({ fingerprint, used: true });

    if (sameIpUsed || sameFpUsed) {
      await tokens.updateOne(
        { token },
        {
          $set: {
            valid: false,
            ip,
            fingerprint,
            userAgent,
            rejectedAt: new Date(),
            pernahBuka: true
          }
        }
      );
      return res.json({ message: '🚫 Verifikasi referral gagal atau ditolak, klik konfirmasi verifikasi di bot.' });
    }

    // ✅ Set token sebagai valid (bonus akan diproses oleh bot)
    await tokens.updateOne(
      { token },
      {
        $set: {
          valid: true,
          ip,
          fingerprint,
          userAgent,
          usedAt: new Date(),
          pernahBuka: true
        }
      }
    );

    return res.json({ message: '✅ Verifikasi berhasil! Klik konfirmasi verifikasi di bot.' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '❌ Internal server error.' });
  }
}
