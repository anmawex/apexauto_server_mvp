import nodemailer from "nodemailer";

const acc = await nodemailer.createTestAccount();
console.log("ETHEREAL_USER=" + acc.user);
console.log("ETHEREAL_PASS=" + acc.pass);
