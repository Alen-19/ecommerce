const nodemailer = require('nodemailer');
const env = require('./config.gmail.env');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
    env.ClientID,
    env.client_secret,
    env.redirect_url
);

oauth2Client.setCredentials({
    refresh_token: env.refresh_token
});

async function sendEmail(to, subject, html) {
    try {
        const accessToken = await oauth2Client.getAccessToken();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: env.emailId,
                clientId: env.ClientID,
                clientSecret: env.client_secret,
                refreshToken: env.refresh_token,
                accessToken: accessToken.token
            }
        });

        const mailOptions = {
            from: `"E-commerce Team" <${env.emailId}>`,
            to,
            subject,
            html // <-- This sends HTML content
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

module.exports = { sendEmail };