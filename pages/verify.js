// pages/verify.js

import fs from 'fs';
import path from 'path';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function VerifyPage() {
  const router = useRouter();
  const { token } = router.query;
  const [message, setMessage] = useState("⏳ Memverifikasi...");

  useEffect(() => {
    if (!token) return;

    async function verifyToken() {
      const res = await fetch(`/api/verify?token=${token}`);
      const data = await res.json();
      setMessage(data.message);
    }

    verifyToken();
  }, [token]);

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'Arial' }}>
      <h1>{message}</h1>
    </div>
  );
}
