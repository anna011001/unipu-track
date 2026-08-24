import nodemailer from "nodemailer";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function logApprovalLink({ administratorEmail, user, approvalUrl }) {
  console.log("\n[UNIPU Track] Novi zahtjev za registraciju");
  console.log(`Administrator: ${administratorEmail}`);
  console.log(`Korisnik: ${user.first_name} ${user.last_name} <${user.email}>`);
  console.log(`Poveznica za odobrenje (vrijedi 48 sati): ${approvalUrl}\n`);
}

export async function notifyRegistrationAdmin({ user, approvalUrl }) {
  const administratorEmail = process.env.ADMIN_EMAIL || "dekan@unipu.hr";

  if (!smtpConfigured()) {
    logApprovalLink({ administratorEmail, user, approvalUrl });
    return { delivered: false };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: administratorEmail,
    subject: "UNIPU Track – zahtjev za registraciju",
    text: [
      "Zaprimljen je novi zahtjev za registraciju u aplikaciji UNIPU Track.",
      "",
      `Korisnik: ${user.first_name} ${user.last_name}`,
      `E-mail: ${user.email}`,
      "",
      "Za odobrenje korisničkog računa otvorite poveznicu:",
      approvalUrl,
      "",
      "Poveznica vrijedi 48 sati i može se iskoristiti samo jednom.",
    ].join("\n"),
  });

  return { delivered: true };
}
