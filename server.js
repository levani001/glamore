const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ატვირთული ფაილების საქაღალდის შექმნა
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer კონფიგურაცია ფოტო/ვიდეო ატვირთვისთვის
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ⚠️ ჩაწერეთ თქვენი Gmail და 16-ნიშნა App Password
const EMAIL_USER = 'levanishainidzee@gmail.com'; 
const EMAIL_PASS = 'prpd nefw jike gzmp'; 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// მონაცემთა ბაზა (მეხსიერებაში)
let bookingsList = []; // [{ id, name, phone, service, date, time, notes }]
let offersList = [];   // [{ id, title, price, mediaUrl, mediaType }]

// --- API: ჯავშნები ---

app.get('/api/booked-slots', (req, res) => {
  const { service, date } = req.query;
  const bookedTimes = bookingsList
    .filter(b => b.service === service && b.date === date)
    .map(b => b.time);
  res.json({ bookedTimes });
});

app.get('/api/admin/bookings', (req, res) => {
  res.json(bookingsList);
});

app.delete('/api/admin/bookings/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  bookingsList = bookingsList.filter(b => b.id !== id);
  res.json({ success: true, message: 'ჯავშანი წაიშალა და საათი გათავისუფლდა!' });
});

app.post('/api/booking', (req, res) => {
  const { name, phone, service, date, time, notes } = req.body;

  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ success: false, message: 'შეავსეთ ყველა სავალდებულო ველი (*)' });
  }

  const isBooked = bookingsList.some(b => b.service === service && b.date === date && b.time === time);
  if (isBooked) {
    return res.status(400).json({ success: false, message: 'ეს დრო უკვე დაკავებულია!' });
  }

  const newBooking = { id: Date.now(), name, phone, service, date, time, notes };
  bookingsList.push(newBooking);

  // მეილის გაგზავნა
  const mailOptions = {
    from: `"Beauty Salon" <${EMAIL_USER}>`,
    to: EMAIL_USER,
    subject: `🔔 ახალი ჯავშანი: ${service} - ${name}`,
    html: `
      <h2>✨ ახალი ჯავშანი სალონში</h2>
      <p><strong>მომხმარებელი:</strong> ${name}</p>
      <p><strong>ტელეფონი:</strong> ${phone}</p>
      <p><strong>სერვისი:</strong> ${service}</p>
      <p><strong>თარიღი/დრო:</strong> ${date} | ${time}</p>
      ${notes ? `<p><strong>შენიშვნა:</strong> ${notes}</p>` : ''}
    `
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) console.error('Email send error:', err);
  });

  res.json({ success: true, message: 'ჯავშანი წარმატებით დარეგისტრირდა!' });
});

// --- API: შეთავაზებები და მედია ---

app.get('/api/offers', (req, res) => {
  res.json(offersList);
});

app.post('/api/admin/offers', upload.single('media'), (req, res) => {
  const { title, price } = req.body;
  if (!title || !price || !req.file) {
    return res.status(400).json({ success: false, message: 'გთხოვთ შეავსოთ ყველა ველი და ატვირთოთ ფაილი.' });
  }

  const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
  const newOffer = {
    id: Date.now(),
    title,
    price,
    mediaUrl: `/uploads/${req.file.filename}`,
    mediaType
  };

  offersList.push(newOffer);
  res.json({ success: true, message: 'შეთავაზება დაემატა!' });
});

app.delete('/api/admin/offers/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const offer = offersList.find(o => o.id === id);
  if (offer) {
    const filePath = path.join(__dirname, offer.mediaUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    offersList = offersList.filter(o => o.id !== id);
  }
  res.json({ success: true, message: 'შეთავაზება წაიშალა!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 სერვერი გაეშვა მისამართზე: http://localhost:${PORT}`);
  console.log(`🔑 ადმინ პანელი: http://localhost:${PORT}/admin.html`);
});