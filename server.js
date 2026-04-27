// server.js
const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1', // Change to your region
});

const s3 = new AWS.S3();
const BUCKET = process.env.AWS_S3_BUCKET || 'amigo-rentals-images'; // Change to your bucket name

app.get('/sign-s3', (req, res) => {
  const { filename, filetype } = req.query;
  if (!filename || !filetype) {
    return res.status(400).json({ error: 'Missing filename or filetype' });
  }
  const params = {
    Bucket: BUCKET,
    Key: filename,
    Expires: 60,
    ContentType: filetype,
    ACL: 'public-read',
  };
  s3.getSignedUrl('putObject', params, (err, url) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ url });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`S3 signing server running on port ${PORT}`);
});
