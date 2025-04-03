const express = require("express");
const cors = require("cors");
const sharp = require('sharp');
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require('path');
const serverless = require("serverless-http");
const wppconnect = require("@wppconnect-team/wppconnect");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname)));

const API_KEY = "b7f9d3a1-5c6e-4d2b-8a9f-23a7fbc982e7"; // Secure API key for authentication
let clientInstance = null;

// Load Templates
const templates = JSON.parse(fs.readFileSync("templates.json", "utf-8"));

// Initialize WPPConnect
// wppconnect
//   .create({
//     session: "session1",
//     catchQR: (qrCode, asciiQR) => console.log("Scan QR:", asciiQR),
//     statusFind: (status) => console.log("Status:", status),
//     browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'], // 🔥 important
//   })
//   .then((client) => {
//     clientInstance = client;
//     console.log("✅ WPPConnect is ready!");
//   })
//   .catch((error) => console.error("WPPConnect Error:", error));

  wppconnect
  .create({
    session: 'sessionName',
    catchQR: (base64Qr, asciiQR) => {
      console.log(asciiQR); // Optional to log the QR in the terminal
      var matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
        response = {};

        if (!matches || matches.length !== 3) {
          return new Error('Invalid input string');
        }
      
        const buffer = Buffer.from(matches[2], 'base64');
      
        // Use sharp to add 4px white border
        sharp(buffer)
          .extend({
            top: 4,
            bottom: 4,
            left: 4,
            right: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .toFile('out.png', (err, info) => {
            if (err) {
              console.error('Error writing file:', err);
            } else {
              console.log('QR saved with border as out.png');
            }
          });
    },
    statusFind: (status) => console.log("Status:", status),
    browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'], // 🔥 important
    logQR: true,
    autoClose: 60000,
  })
  .then((client) => {
    clientInstance = client;
    console.log("✅ WPPConnect is ready!");
  })
  .catch((error) => console.error("WPPConnect Error:", error));


// Middleware: API Key Authentication
const authenticate = (req, res, next) => {
  // console.log("API Key:", req.headers);
  if (req.headers["x-api-key"] !== API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
};

// API: Send Message Based on Template /*authenticate*/
app.post("/send-message", authenticate, async (req, res) => {
  if (!clientInstance) return res.status(500).json({ error: "WPPConnect not initialized" });

  const { campaignName, destination, templateParams } = req.body;

  // Find template by ID
  const template = templates.find(t => t.templateId === campaignName);
  if (!template) return res.status(400).json({ error: "Invalid templateId" });

  // Replace placeholders in message
  let formattedMessage = template.message;
  templateParams.forEach((param, index) => {
    formattedMessage = formattedMessage.replace(`{{${index + 1}}}`, param);
  });

  try {
    let response;

    switch (template.messageType) {
      case "message":
        response = await clientInstance.sendText(`${destination}@c.us`, formattedMessage);
        break;

      case "image":
        response = await clientInstance.sendImage(
          `${destination}@c.us`,
          template.metadata.image,
          "promo.jpg",
          formattedMessage
        );
        break;

      case "video":
        response = await clientInstance.sendVideoAsGif(
          `${destination}@c.us`,
          template.metadata.video,
          "promo.mp4",
          formattedMessage
        );
        break;

      case "link":
        response = await clientInstance.sendLinkPreview(
          `${destination}@c.us`,
          template.metadata.link,
          formattedMessage
        );
        break;

      default:
        return res.status(400).json({ error: "Unsupported messageType" });
    }

    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
});

// API: Receive Incoming Messages
// function start(client) {
//   client.onMessage((message) => {
//     console.log("📩 Incoming Message:", message.body);
//     const text = message.body.trim().toLowerCase();

//     const responses = {
//       "hello": "Hello! How can I assist you? 😊",
//       "hi": "Hi there! 👋 Need help?",
//       "help": "Here are some commands:\n- Order Status\n- Promotions\n- Support",
//       "order": "Please provide your order ID to check the status. 📦",
//       "bye": "Goodbye! Have a great day! 😊"
//     };

//     if (responses[text]) {
//       client.sendText(message.from, responses[text]);
//     }
//   });
// }

module.exports.handler = serverless(app);

// Start Server
app.listen(9000, () => {
  console.log("🚀 Server running at http://localhost:9000");
});
