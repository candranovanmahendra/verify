import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export default function VerifyPage() {
  const router = useRouter();
  const { token } = router.query;
  const [message, setMessage] = useState("⏳ Memverifikasi...");

  useEffect(() => {
    if (!token) return;

    async function verifyToken() {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const fingerprint = result.visitorId;

        const res = await fetch(`/api/verify?token=${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fingerprint }),
        });

        const data = await res.json();
        setMessage(data.message);
      } catch (err) {
        console.error(err);
        setMessage("❌ Gagal memverifikasi. Coba lagi nanti.");
      }
    }

    verifyToken();
  }, [token]);

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'Arial' }}>
      <h1>{message}</h1>
    </div>
  );
}
