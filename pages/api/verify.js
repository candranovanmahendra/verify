import clientPromise from '../../lib/mongodb';
import { isVpn } from "../../lib/isVpn";

const BOT_API = 'https://verify-three-rosy.vercel.app/verify';
const SECRET_KEY = process.env.SECRET_KEY;

export default async function handler(req, res) {
  const { token } = req.query;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  if (!token) {
    return res.status(400).json({ message: '❌ Token tidak ditemukan.' });
  }

  try {
    // Cek apakah IP menggunakan VPN (offline method)
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

    if (tokenData.used) {
      return res.json({ message: '🚫 Verifikasi referral gagal atau ditolak, klik konfirmasi verifikasi di bot.' });
    }

    const sameIpUsed = await tokens.findOne({ ip, used: true });
    if (sameIpUsed) {
      await tokens.updateOne(
        { token },
        {
          $set: {
            used: true,
            valid: false,
            ip,
            rejectedAt: new Date()
          }
        }
      );
      return res.json({ message: '🚫 Verifikasi referral gagal atau ditolak, klik konfirmasi verifikasi di bot.' });
    }

    await tokens.updateOne(
      { token },
      {
        $set: {
          used: true,
          valid: true,
          ip,
          usedAt: new Date()
        }
      }
    );

    await fetch(BOT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SECRET_KEY
      },
      body: JSON.stringify({
        userId: tokenData.userId,
        referrerId: tokenData.referrerId,
        token,
        ip
      })
    });

    return res.json({ message: '✅ Verifikasi berhasil! klik konfirmasi verifikasi di bot.' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '❌ Internal server error.' });
  }
}
