const nodemailer = require('nodemailer');

const  transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'matcha1337@gmail.com',
        pass: '---password---'
    }
});

module.exports = {
    sendEmail(to, subject, html) {
        return new Promise((resolve, reject) => {
            var from = 'matcha1337@gmail.com';
            transport.sendMail({ from, subject, to, html}, (err, info) => {
                if(err) reject(err);
                resolve(info);
            });
        });
    }
}
