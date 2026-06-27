require('dotenv').config();
const dns = require('dns');
// Set DNS servers to Google's public DNS to resolve MongoDB Atlas SRV records reliably
dns.setServers(['8.8.8.8', '8.8.4.4']);

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { OpenAI } = require('openai');

const KeyValue = require('./models/KeyValue');
const ImageBank = require('./models/ImageBank');
const Submission = require('./models/Submission');
const Team = require('./models/Team');

const app = express();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

  },
});

app.use(cors());
app.use(express.json());

const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.log("MongoDB Connection Error:", err));

app.post('/api/admin/upload-image', upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const uploadedUrls = [];

    for (const file of req.files) {
      const fileContent = file.buffer;
      const extension = file.originalname.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
      const key = `reference/${uuidv4()}.${extension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: file.mimetype,
      });

      await s3.send(command);

      const fullUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      uploadedUrls.push(fullUrl);

      const newImage = new ImageBank({
        url: fullUrl,
      });
      await newImage.save();
    }

    res.json({
      success: true,
      urls: uploadedUrls
    });

  } catch (err) {
    console.error("Admin S3 Upload Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to upload image to S3",
      error: err.message,
    });
  }
});

app.post('/api/player/upload-submission', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { teamId, round } = req.body;
    if (!teamId || !round) {
      return res.status(400).json({ success: false, message: "teamId and round are required" });
    }

    const team = await Team.findById(teamId);
    if (!team) {
        return res.status(404).json({
            success: false,
            message: "Team not found"
        });
    }

    const fileContent = req.file.buffer;
    const extension = req.file.originalname.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
    const key = `submissions/${teamId}/${round}/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: req.file.mimetype,
    });

    await s3.send(command);

    const fullUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const newSubmission = new Submission({
      team: teamId,
      round: round,
      finalImageUrl: fullUrl,
    });

    await newSubmission.save();

    res.json({
      success: true,
      url: fullUrl
    });

  } catch (err) {
    console.error("Player S3 Upload Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to upload image to S3",
      error: err.message,
    });
  }
});

const apiRoutes = require('./routes/api');
app.use('/api/game', apiRoutes);

const usedGeminiLinks = new Set();

app.post('/api/verify-gemini', (req, res) => {
  const { link } = req.body;
  if (!link || !link.toLowerCase().includes('gemini')) {
    return res.status(400).json({ error: "Invalid Gemini Link. It must be a valid Google Gemini URL." });
  }
  if (usedGeminiLinks.has(link)) {
    return res.status(400).json({ error: "This Gemini link has already been submitted by another team. You must use your own chat." });
  }
  usedGeminiLinks.add(link);
  res.json({ success: true });
});

let currentTargetIndex = 0;

app.get('/api/target-image', async (req, res) => {
  try {
    const images = await ImageBank.find();
    if (images.length === 0) {
      return res.json({ url: 'https://picsum.photos/seed/default/800/800' });
    }
    const storedUrl = images[currentTargetIndex % images.length].url;
    currentTargetIndex = (currentTargetIndex + 1) % images.length;
    
    res.json({ url: storedUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch image", error: err.message });
  }
});

app.get('/api/admin/images', async (req, res) => {
  try {
    const images = await ImageBank.find();
    res.json(images);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch images", error: err.message });
  }
});

app.post('/api/admin/images', async (req, res) => {
  try {
    const { url } = req.body;
    const newImage = new ImageBank({ url });
    await newImage.save();
    res.json(newImage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/images/:id', async (req, res) => {
  try {
    const image = await ImageBank.findById(req.params.id);
    if (image && image.url && image.url.includes('.amazonaws.com/')) {
      const key = image.url.split('.amazonaws.com/')[1];
      if (key) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: key
        });
        await s3.send(deleteCommand).catch(err => console.error("S3 Delete Error:", err));
      }
    }
    await ImageBank.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/similarity', async (req, res) => {
  try {
    const { original_url, submitted_url } = req.body;
    const response = await fetch('http://localhost:8000/api/similarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_url, submitted_url })
    });
    if (!response.ok) {
      throw new Error(`AI service returned status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Similarity Error:", err);
    res.status(500).json({ error: "Similarity scoring failed" });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });
      return res.json({ images: [response.data[0].url] });
    }

    // Fallback since API key might be missing/invalid
    const seed = Date.now();
    const images = [`https://picsum.photos/seed/${seed}/1024/1024`];
    res.json({ images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image generation failed" });
  }
});

const GameState = require('./models/GameState');

app.get('/api/game/status', async (req, res) => {
  try {
    let session = await GameState.findOne({ key: 'main' });
    if (!session) {
      session = new GameState({ key: 'main' });
      await session.save();
    }
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/game/start', async (req, res) => {
  try {
    const { action, round, duration } = req.body;
    let session = await GameState.findOne({ key: 'main' });
    if (!session) {
      session = new GameState({ key: 'main' });
    }

    const now = new Date();

    if (action === 'start_round') {
      const roundKey = `round${round}`;
      const durationSeconds = duration || session.roundDurations[roundKey];
      session.status = `round${round}_active`;
      session.currentRound = round;
      session.roundStartTime = now;
      session.roundEndTime = new Date(now.getTime() + durationSeconds * 1000);
      if (duration) session.roundDurations[roundKey] = durationSeconds;
      session.isPaused = false;
    } else if (action === 'pause_round') {
      if (!session.isPaused) {
        session.isPaused = true;
        session.pausedAt = now;
        const remaining = Math.max(0, new Date(session.roundEndTime).getTime() - now.getTime());
        session.timeRemainingAtPause = remaining;
      }
    } else if (action === 'resume_round') {
      if (session.isPaused) {
        session.isPaused = false;
        session.roundEndTime = new Date(now.getTime() + (session.timeRemainingAtPause || 0));
      }
    } else if (action === 'end_round') {
      session.status = `round${round}_ended`;
      session.isPaused = false;
    } else if (action === 'finish') {
      session.status = 'finished';
      session.isPaused = false;
    } else if (action === 'reset') {
      session.status = 'waiting';
      session.currentRound = 0;
      session.roundStartTime = null;
      session.roundEndTime = null;
      session.isPaused = false;
      session.pausedAt = null;
      session.timeRemainingAtPause = null;
      usedGeminiLinks.clear();
      // Note: purging teams is handled via global reset in frontend/db
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    await session.save();
    io.emit('session_update', session);
    res.json({ session, message: 'Success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  // Send all current keys to the newly connected client
  try {
    const allData = await KeyValue.find();
    const initialState = {};
    allData.forEach(item => {
      initialState[item.key] = item.value;
    });
    socket.emit('initialData', initialState);
  } catch (e) {
    console.log("Error fetching KeyValue on connection:", e.message);
  }

  // Handle Event Broadcasts
  socket.on('broadcastEvent', (data) => {
    // data = { eventType, payload }
    io.emit('maya_event', data);
  });

  // Anti-Cheat Events
  socket.on('anti_cheat_violation', async (data) => {
    // data = { teamId, type: 'tab_switch' | 'fullscreen_exit' }
    const Team = require('./models/Team');
    if (data.teamId) {
      const update = data.type === 'tab_switch' ? { $inc: { tabSwitchCount: 1, warnings: 1 } } : { $inc: { fullscreenExits: 1, warnings: 1 } };
      await Team.findByIdAndUpdate(data.teamId, update);
      io.emit('admin_alert', { teamId: data.teamId, type: data.type, message: `Violation detected: ${data.type}` });
    }
  });

  // Admin changing phases directly via socket
  socket.on('set_phase', (newPhase) => {
    io.emit('maya_event', { eventType: 'phase_changed', payload: { phase: newPhase } });
  });

  // Handle Key-Value SyncState Updates
  socket.on('syncStateUpdate', async ({ key, value }) => {
    // Update DB
    await KeyValue.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );
    // Broadcast to all OTHER clients (the sender already optimistically updated)
    socket.broadcast.emit('syncStateUpdated', { key, value });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
