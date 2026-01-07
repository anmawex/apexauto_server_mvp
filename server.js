/**
 * ✅ SERVIDOR DE CORREOS (Express + Nodemailer)
 *
 * Imagina que tu app (frontend) es un niño que quiere mandar una carta,
 * pero no puede ir a la oficina de correos solo.
 *
 * Este servidor es el adulto que:
 * 1) recibe la carta (datos del correo)
 * 2) va a la oficina de correos (SMTP/Ethereal)
 * 3) la envía
 *
 * IMPORTANTE:
 * - Este archivo corre en Node.js (servidor), NO en el navegador.
 * - Aquí sí pueden vivir secretos (passwords) en un archivo .env
 */

import express from "express"; // Para crear el servidor web (rutas como /send)
import cors from "cors"; // Para permitir que tu frontend lo llame desde otro puerto
import nodemailer from "nodemailer"; // Para enviar correos
import "dotenv/config"; // Para leer variables del archivo .env

const app = express();

/**
 * Esto le dice a Express:
 * "Si alguien me manda JSON (texto con llaves), entiéndelo."
 */
app.use(express.json());

/**
 * CORS:
 * Permite que tu frontend (por ejemplo http://localhost:5173)
 * pueda llamar a este backend (http://localhost:3001).
 */
app.use(
	cors({
		origin: process.env.CORS_ORIGIN || true, // true = permitir todo (solo recomendado en dev)
	})
);

/**
 * Función chiquita para convertir texto a booleano.
 * Porque en .env todo llega como TEXTO.
 * Ej: "true" -> true, "false" -> false
 */
function toBool(v) {
	return String(v).toLowerCase() === "true";
}

/**
 * Crear el "transportador" de correos:
 * Esto es como escoger la empresa de mensajería:
 *
 * - Modo ETHEREAL: correo de prueba (NO envía a personas reales)
 * - Modo SMTP: correo real (Gmail, Outlook, dominio propio, etc.)
 */
async function createTransporter() {
	const mode = (process.env.MAIL_MODE || "ethereal").toLowerCase();

	// ✅ MODO REAL (SMTP)
	if (mode === "smtp") {
		const host = process.env.SMTP_HOST;
		const port = Number(process.env.SMTP_PORT || 587);
		const secure = toBool(process.env.SMTP_SECURE || "false");
		const user = process.env.SMTP_USER;
		const pass = process.env.SMTP_PASS;

		// Si faltan datos, mejor decirlo claro
		if (!host || !user || !pass) {
			throw new Error("Faltan variables SMTP_* en .env para MAIL_MODE=smtp");
		}

		// Nodemailer va a usar este SMTP para enviar correos reales
		return nodemailer.createTransport({
			host,
			port,
			secure,
			auth: { user, pass },
		});
	}

	// ✅ MODO PRUEBA (ETHEREAL)
	// Nodemailer crea una cuenta falsa automáticamente
	const testAccount = await nodemailer.createTestAccount();

	// Retornamos un transportador listo para enviar "correos de mentira"
	return {
		transporter: nodemailer.createTransport({
			host: "smtp.ethereal.email",
			port: 587,
			secure: false,
			auth: {
				user: testAccount.user,
				pass: testAccount.pass,
			},
		}),
		testAccount,
	};
}

/**
 * Ruta de salud:
 * Sirve para saber si el servidor está vivo.
 * Si abres /health y ves ok: true, el servidor funciona.
 */
app.get("/health", (_req, res) => {
	res.json({ ok: true });
});

/**
 * Ruta principal para enviar correos:
 *
 * Tu frontend hará un POST a /send con un JSON como:
 * {
 *   "to": "alguien@correo.com",
 *   "subject": "Hola",
 *   "text": "Mensaje..."
 * }
 *
 * O también puedes mandar "html" en vez de "text".
 */
app.post("/send", async (req, res) => {
	try {
		// Sacamos los datos que llegaron
		const { to, subject, text, html } = req.body || {};

		// Validación súper básica:
		// necesitamos destinatario, asunto, y contenido (text o html)
		if (!to || !subject || (!text && !html)) {
			return res.status(400).json({
				ok: false,
				error: "Campos requeridos: to, subject, y text o html",
			});
		}

		const mode = (process.env.MAIL_MODE || "ethereal").toLowerCase();

		// ✅ Si estamos en modo SMTP (real)
		if (mode === "smtp") {
			const transporter = await createTransporter();
			const info = await transporter.sendMail({
				from: process.env.MAIL_FROM || process.env.SMTP_USER, // "quién lo envía"
				to, // "a quién"
				subject, // "título"
				text, // texto simple
				html, // html (opcional)
			});

			return res.json({ ok: true, messageId: info.messageId });
		}

		// ✅ Si estamos en modo Ethereal (prueba)
		const { transporter } = await createTransporter();
		const info = await transporter.sendMail({
			from: '"Mi App (Test)" <test@ethereal.email>',
			to,
			subject,
			text,
			html,
		});

		/**
		 * Ethereal te da un link para "ver" el correo en el navegador.
		 * Esto es genial para pruebas.
		 */
		const previewUrl = nodemailer.getTestMessageUrl(info);
		return res.json({ ok: true, messageId: info.messageId, previewUrl });
	} catch (err) {
		// Si algo falla, lo mostramos en consola (para debug)
		console.error(err);
		return res.status(500).json({ ok: false, error: "Error enviando correo" });
	}
});

/**
 * Encender el servidor:
 * Lo deja escuchando en el puerto 3001 (o el que pongas en .env).
 */
const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
	console.log(`Mail server listening on http://localhost:${port}`);
});
