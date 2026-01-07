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
import { Resend } from "resend";

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

		if (!host || !user || !pass) {
			throw new Error("Faltan variables SMTP_* en .env para MAIL_MODE=smtp");
		}

		return {
			transporter: nodemailer.createTransport({
				host,
				port,
				secure,
				auth: { user, pass },
			}),
		};
	}

	// ✅ MODO PRUEBA (ETHEREAL) - SIN createTestAccount()
	const ethUser = process.env.ETHEREAL_USER;
	const ethPass = process.env.ETHEREAL_PASS;

	if (!ethUser || !ethPass) {
		throw new Error(
			"Faltan ETHEREAL_USER y/o ETHEREAL_PASS para MAIL_MODE=ethereal"
		);
	}

	return {
		transporter: nodemailer.createTransport({
			host: "smtp.ethereal.email",
			port: 587,
			secure: false,
			auth: { user: ethUser, pass: ethPass },
		}),
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
		const { to, subject, text, html } = req.body || {};

		if (!to || !subject || (!text && !html)) {
			return res.status(400).json({
				ok: false,
				error: "Campos requeridos: to, subject, y text o html",
			});
		}

		const mode = (process.env.MAIL_MODE || "api").toLowerCase();

		// ✅ MODO API (Resend) — recomendado para Render/Railway
		if (mode === "api") {
			if (!process.env.RESEND_API_KEY) {
				return res.status(500).json({
					ok: false,
					error: "Falta RESEND_API_KEY en variables de entorno",
				});
			}

			const resend = new Resend(process.env.RESEND_API_KEY);

			const result = await resend.emails.send({
				from: "Pruebas <onboarding@resend.dev>",
				to,
				subject,
				text,
				html,
			});

			return res.json({
				ok: true,
				id: result?.data?.id || result?.id,
			});
		}

		// ✅ MODO SMTP / ETHEREAL (solo funcionará donde SMTP no esté bloqueado)
		const { transporter } = await createTransporter();

		const info = await transporter.sendMail({
			from:
				mode === "smtp"
					? process.env.MAIL_FROM || process.env.SMTP_USER
					: '"Mi App (Test)" <test@ethereal.email>',
			to,
			subject,
			text,
			html,
		});

		const previewUrl = nodemailer.getTestMessageUrl(info);
		return res.json({
			ok: true,
			messageId: info.messageId,
			...(mode === "smtp" ? {} : { previewUrl }),
		});
	} catch (err) {
		console.error("SEND ERROR:", err);
		return res
			.status(500)
			.json({ ok: false, error: err?.message || "Error enviando correo" });
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
