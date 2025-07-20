import clientPromise from '../../lib/mongodb';

const BOT_API = 'https://verify-three-rosy.vercel.app/verify';
const SECRET_KEY = process.env.SECRET_KEY;

export default async function handler(req, res) {
  const { token } = req.query;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!token) {
    return res.status(400).json({ message: '❌ Token tidak ditemukan.' });
  }

  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB); // Ganti sesuai nama DB kamu
    const tokens = db.collection('referral_tokens');

    const tokenData = await tokens.findOne({ token });

    if (!tokenData) {
      return res.json({ message: '❌ Token tidak valid.' });
    }

    // Jika token sudah digunakan
    if (tokenData.used) {
      if (tokenData.valid === false) {
        return res.json({ message: '🚫 Verifikasi sebelumnya ditolak karena IP kamu sudah dipakai.' });
      }
      return res.json({ message: '⚠️ Token sudah digunakan sebelumnya.' });
    }

    // Cek apakah IP sudah pernah dipakai verifikasi
    const sameIpUsed = await tokens.findOne({ ip, used: true });
    if (sameIpUsed) {
      // Tandai token ini sebagai ditolak
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
      return res.json({ message: '🚫 IP kamu sudah pernah digunakan. Verifikasi ditolak.' });
    }

    // Tandai token ini sebagai valid dan digunakan
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

    // Kirim ke bot untuk proses bonus
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

    return res.json({ message: '✅ Verifikasi berhasil! Bonus referral dikirim!' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '❌ Internal server error.' });
  }
}
