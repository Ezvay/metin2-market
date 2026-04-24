const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FROM = process.env.EMAIL_FROM || 'noreply@projekthard.pl';

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = require('resend');
  return new Resend(process.env.RESEND_API_KEY);
}

const base = `font-family:Georgia,serif;background:#0a0805;color:#e8d5a3;max-width:560px;margin:0 auto;border:1px solid #3a2c18;border-radius:8px;overflow:hidden;`;
const hdr = (t) => `<div style="background:linear-gradient(135deg,#1a1008,#2a1c0e);padding:28px 32px;border-bottom:2px solid #d4a012;text-align:center;"><div style="font-size:28px;margin-bottom:6px">🐉</div><div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#d4a012;letter-spacing:2px">PROJEKT HARD</div><div style="font-size:12px;color:#8a7355;letter-spacing:1px">MARKETPLACE</div></div><div style="padding:28px;"><h2 style="color:#f0c53a;margin:0 0 14px;">${t}</h2>`;
const ftr = `</div><div style="background:#110e09;padding:14px 28px;border-top:1px solid #3a2c18;text-align:center;font-size:12px;color:#5a4a30;">Projekt Hard Marketplace &bull; Wiadomość automatyczna</div>`;
const btn = (href, label, bg='#c8940e') => `<div style="text-align:center;margin:24px 0;"><a href="${href}" style="background:${bg};color:#0a0805;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;letter-spacing:1px;display:inline-block;">${label}</a></div>`;

async function send(to, subject, html) {
  const r = getResend();
  if (!r) { console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`); return; }
  try { await r.emails.send({ from: FROM, to, subject, html }); }
  catch (e) { console.error('Email error:', e.message); }
}

async function sendVerificationEmail(email, username, token) {
  const link = `${APP_URL}/?p=verify&token=${token}`;
  await send(email, '⚔️ Potwierdź konto — Projekt Hard Market',
    `<div style="${base}">${hdr('Witaj na arenie, ' + username + '!')}
    <p style="color:#c8a96a;line-height:1.7">Kliknij przycisk poniżej, aby aktywować konto.</p>
    ${btn(link, '⚔️ AKTYWUJ KONTO')}
    <p style="color:#5a4a30;font-size:13px">Link wygasa po 24h.</p>${ftr}</div>`);
}

async function sendPasswordResetEmail(email, username, token) {
  const link = `${APP_URL}/?p=reset-password&token=${token}`;
  await send(email, '🔑 Reset hasła — Projekt Hard Market',
    `<div style="${base}">${hdr('Reset hasła')}
    <p style="color:#c8a96a;line-height:1.7">Cześć <strong style="color:#d4a012">${username}</strong>! Kliknij aby zresetować hasło.</p>
    ${btn(link, '🔑 RESETUJ HASŁO', '#8b1a1a')}
    <p style="color:#5a4a30;font-size:13px">Link wygasa po 1h.</p>${ftr}</div>`);
}

async function sendNewMessageEmail(email, username, fromUsername, offerTitle) {
  await send(email, `💬 Wiadomość od ${fromUsername} — Projekt Hard Market`,
    `<div style="${base}">${hdr('Masz nową wiadomość!')}
    <p style="color:#c8a96a;line-height:1.7">Cześć <strong style="color:#d4a012">${username}</strong>!<br>
    Użytkownik <strong style="color:#d4a012">${fromUsername}</strong> napisał do Ciebie${offerTitle?` ws. "<em>${offerTitle}</em>"`:''}.</p>
    ${btn(APP_URL, '💬 PRZEJDŹ DO WIADOMOŚCI')}${ftr}</div>`);
}

async function sendTutorRequestEmail(email, sellerUsername, buyerUsername, offerTitle) {
  await send(email, `🛡️ Żądanie TuTora — Projekt Hard Market`,
    `<div style="${base}">${hdr('Żądanie TuTora')}
    <p style="color:#c8a96a;line-height:1.7">Cześć <strong style="color:#d4a012">${sellerUsername}</strong>!<br>
    Kupujący <strong style="color:#d4a012">${buyerUsername}</strong> chce TuTora dla: <strong style="color:#f0c53a">${offerTitle}</strong>.</p>
    <p style="color:#c8a96a">Koszt 20 PLN. Zaloguj się po więcej szczegółów.</p>
    ${btn(APP_URL, '🛡️ PRZEJDŹ DO PANELU')}${ftr}</div>`);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendNewMessageEmail, sendTutorRequestEmail };
