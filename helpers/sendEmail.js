require('dotenv').config();
const sgMail = require('@sendgrid/mail');

const {SENDER_EMAIL, SENDGRID_API_KEY} = process.env;

sgMail.setApiKey(SENDGRID_API_KEY); 
// const data = {
//   to: email,
//   from: 'MJ_SENDER_EMAIL', 
//   subject: 'Sending with SendGrid is Fun',
//   html: '<strong>and easy to do anywhere, even with Node.js</strong>',
// };

const sendEmail = async(data) => {
  await sgMail
  .send({...data, from: SENDER_EMAIL})
  return true
}

module.exports = sendEmail;