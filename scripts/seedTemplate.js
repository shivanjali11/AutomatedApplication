// Inserts or updates the "default" application template in MongoDB.
// Edit the content below and re-run `npm run seed` to change what gets sent.
const { connectDB, disconnectDB } = require('../src/db');
const Template = require('../src/models/Template');
const config = require('../src/config');

const subject = 'Application for Backend Developer Role – Shivanjali Kumari (2+ Years Experience)';

const details = [
  ['Total Experience', '2+ years'],
  ['Current Company', 'Rapipay Fintech Pvt. Ltd.'],
  ['Current Role', 'Software Engineer'],
  ['Primary Profile', 'Backend Developer (Node.js / Java)'],
  ['Current Location', 'Noida'],
  ['Preferred Location', 'Pan India'],
];

// Kept stack-neutral so this works for both Node.js and Java backend postings.
const skills = [
  ['Languages', 'JavaScript, TypeScript, Java, Python, C++'],
  ['Backend', 'Node.js, Express.js'],
  ['Databases & Caching', 'MongoDB, SQL, Redis'],
  ['Messaging', 'RabbitMQ'],
  ['Core Concepts', 'Data Structures & Algorithms, OOP, System Design, Microservices Architecture'],
  ['APIs & Tools', 'REST APIs, Third-party API Integration, Postman'],
  ['Version Control', 'Git / Bitbucket / GitLab'],
];

const linkedin = 'https://www.linkedin.com/in/shivanjali-kumari-239b3122b/';

const intro = [
  'I hope you are doing well.',
  'I am Shivanjali Kumari, a Software Engineer with 2+ years of experience at Rapipay Fintech Pvt. Ltd., specializing in backend development.',
  'My hands-on professional experience is with Node.js and Express.js, and I also have a strong foundation in Java, Object-Oriented Programming, Data Structures & Algorithms, and System Design from my Computer Science background. I have experience building scalable REST APIs, implementing business logic, database design and optimization, caching, asynchronous processing, third-party API integrations, error handling, debugging, and improving application performance and reliability — skills that translate directly across backend stacks, including Java.',
  'Please find my professional details below:',
];

const outro = [
  'I am currently looking for Backend Developer opportunities (Node.js or Java) where I can work on scalable systems, solve challenging backend problems, and continue growing as a software engineer.',
  'Please find my updated resume attached for your consideration.',
];

const closing = [
  'I would appreciate the opportunity to discuss my profile further. Please feel free to reach out if my profile matches any relevant opening.',
  'Thank you for your time and consideration.',
];

// Explicit margins on every <p>/<ul>/<li> — without these, each email client
// (Gmail, Outlook, Apple Mail) applies its own default paragraph/list spacing,
// which stacks with our line-height and makes the email look inconsistently
// over-spaced depending on where it's opened. Pinning it here keeps spacing
// identical everywhere.
const item = ([k, v]) => (v ? `<li style="margin:0 0 4px 0;"><b>${k}:</b> ${v}</li>` : `<li style="margin:0 0 4px 0;"><b>${k}</b></li>`);
const p = (s) => `<p style="margin:0 0 12px 0;">${s}</p>`;

const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">
<p style="margin:0 0 12px 0;">Dear {{name|Hiring Team}},</p>
${intro.map(p).join('\n')}
<ul style="margin:0 0 12px 0;padding-left:20px;">${details.map(item).join('')}</ul>
<p style="margin:0 0 12px 0;"><b>Technical Skills:</b></p>
<ul style="margin:0 0 12px 0;padding-left:20px;">${skills.map(item).join('')}</ul>
${outro.map(p).join('\n')}
<p style="margin:0 0 12px 0;"><b>LinkedIn:</b> <a href="${linkedin}">${linkedin}</a></p>
${closing.map(p).join('\n')}
<p style="margin:0;">Best regards,<br><b>Shivanjali Kumari</b><br>Software Engineer | Backend Developer<br>+91 8757679339<br><a href="mailto:shivanjali1108@gmail.com">shivanjali1108@gmail.com</a></p>
</div>`;

const line = ([k, v]) => (v ? `• ${k}: ${v}` : `• ${k}`);

const text = [
  'Dear {{name|Hiring Team}},',
  ...intro,
  details.map(line).join('\n'),
  'Technical Skills:\n' + skills.map(line).join('\n'),
  ...outro,
  `LinkedIn: ${linkedin}`,
  ...closing,
  'Best regards,\nShivanjali Kumari\nSoftware Engineer | Backend Developer\n+91 8757679339\nshivanjali1108@gmail.com',
].join('\n\n');

(async () => {
  await connectDB();
  await Template.findOneAndUpdate(
    { name: config.templateName },
    { name: config.templateName, subject, html, text, active: true },
    { upsert: true }
  );
  console.log(`[seed] template "${config.templateName}" saved`);
  await disconnectDB();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
