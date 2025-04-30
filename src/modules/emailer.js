import nodemailer from "nodemailer";

/**
 * @exports emailer
 * @param {any} opts
 * `{
 * 	to: string,
 * 	subject: string,
 * 	text: string // For non html mail clients
 * 	html: string // HTML structure to send as email
 * }`
 * @description Set an email and send it. This is the default transport so we're not creating a new one each time we
 * need to send an email.
 * @return {Promise}
 */
export default async (opts) => new Promise(async (resolve, reject) => {
  try {
    const transporter = nodemailer.createTransport({
      host: global.gConfig.nodemailer.host,
      port: global.gConfig.nodemailer.port,
      secure: global.gConfig.nodemailer.secure,
      auth: {
        user: global.gConfig.nodemailer.mail,
        pass: global.gConfig.nodemailer.pass,
      },
    });

    const mailOptions = {
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    };

    console.log("%cemailer.js line:36 mailOptions", "color: #007acc;", mailOptions);

    await transporter.sendMail(mailOptions);
    resolve("ok");
  } catch (err) {
    reject(err);
  }
});
