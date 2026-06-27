require('dotenv').config();
const dns = require('dns');
// Set DNS servers to Google's public DNS to resolve MongoDB Atlas SRV records reliably
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { OpenAI } = require('openai');

const KeyValue = require('./models/KeyValue');
const ImageBank = require('./models/ImageBank');

const app = express();
app.use(cors());
app.use(express.json());

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// OpenAI removed, using Hugging Face Inference API

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log("MongoDB Connection Error:", err));
} else {
  console.warn('WARNING: MONGO_URI is not set. Database features will not work.');
}

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
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
    const url = images[currentTargetIndex % images.length].url;
    currentTargetIndex = (currentTargetIndex + 1) % images.length;
    res.json({ url });
  } catch(err) {
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

app.get('/api/admin/images', async (req, res) => {
  try {
    const images = await ImageBank.find();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await ImageBank.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/similarity', async (req, res) => {
  try {
    const { original_url, submitted_url } = req.body;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await fetch(`${aiServiceUrl}/api/similarity`, {
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
    
      console.log(`Generating image for prompt: "${prompt}" via Pollinations AI...`);
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=1024&height=1024&nologo=true&model=flux`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Generation API Error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const filename = `${Date.now()}-gen.jpg`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, buffer);

      return res.json({ images: [`/uploads/${filename}`] });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "Image generation failed: " + err.message });
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
  } catch(e) {
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
    if(data.teamId) {
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
