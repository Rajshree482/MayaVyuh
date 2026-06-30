require('dotenv').config();

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { OpenAI } = require('openai');

// Disable buffering to fail fast if DB connection drops or is missing
mongoose.set('bufferCommands', false);

const KeyValue = require('./models/KeyValue');
const ImageBank = require('./models/ImageBank');
const Submission = require('./models/Submission');
const Team = require('./models/Team');
const GameState = require('./models/GameState');

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
  limits: { fileSize: 8 * 1024 * 1024 }
});

// OpenAI removed, using Hugging Face Inference API

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB Connected');
      server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => {
      console.log("MongoDB Connection Error:", err);
      // Still start server to allow non-DB routes to work or to show explicit errors
      server.listen(PORT, () => console.log(`Server running on port ${PORT} (DB Connection Failed)`));
    });
} else {
  console.warn('WARNING: MONGO_URI is not set. Database features will not work.');
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

app.post('/api/admin/upload-image', upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const uploadedUrls = [];

    const highestImage = await ImageBank.findOne().sort('-teamNumber');
    let nextTeamNumber = highestImage && highestImage.teamNumber ? highestImage.teamNumber + 1 : 1;

    for (const file of req.files) {
      const fileContent = file.buffer;
      const mimeToExt = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png' };
      let rawExt = file.originalname.includes('.') ? file.originalname.split('.').pop() : '';
      let extension = mimeToExt[file.mimetype] || rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
      if (extension === 'jpeg') extension = 'jpg';
      const filename = `team_${nextTeamNumber}.${extension}`;
      const key = `reference/${filename}`;

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
        teamNumber: nextTeamNumber,
        filename: filename
      });
      await newImage.save();
      nextTeamNumber++;
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
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const { teamId, round } = req.body;
    if (!teamId || !round) {
      return res.status(400).json({ success: false, error: "teamId and round are required" });
    }

    const fileContent = req.file.buffer;
    const extension = req.file.originalname.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
    
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: "Team not found" });
    }

    const sanitizedTeamName = team.name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');

    // Always perfectly organize by team and round
    const key = `submissions/${sanitizedTeamName}/round${round}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: req.file.mimetype,
    });

    await s3.send(command);

    const fullUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    await Submission.findOneAndUpdate(
      { team: teamId, round: round },
      { finalImageUrl: fullUrl, teamName: team.name },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, url: fullUrl });

  } catch (err) {
    console.error("Player S3 Upload Error:", err);
    res.status(500).json({ success: false, error: "Failed to upload image to S3: " + err.message });
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
    const teamId = req.query.teamId;
    let team = null;

    if (teamId) {
      team = await Team.findById(teamId);
    }
    
    if (!team) {
      team = await Team.findOne({ status: 'active' }) || await Team.findOne();
    }

    const session = await GameState.findOne({ key: 'main' });
    const currentRound = session ? session.currentRound : 1;

    let targetUrl = null;

    if (team) {
      if (currentRound === 1) {
        const assignedImage = await ImageBank.findOne({ teamNumber: team.teamNumber });
        if (assignedImage) targetUrl = assignedImage.url;
      } else if (currentRound === 2) {
        const submission = await Submission.findOne({ team: team._id, round: 1 });
        if (submission && submission.finalImageUrl) targetUrl = submission.finalImageUrl;
      } else if (currentRound >= 3) {
        const submission = await Submission.findOne({ team: team._id, round: 2 });
        if (submission && submission.finalImageUrl) targetUrl = submission.finalImageUrl;
      }
      
      if (!targetUrl && currentRound === 1) {
        const assignedImage = await ImageBank.findOne({ teamNumber: team.teamNumber });
        if (assignedImage) targetUrl = assignedImage.url;
      }
    }

    if (!targetUrl) {
      // Fallback only if no specific image is found, but don't randomly assign anymore
      targetUrl = 'https://picsum.photos/seed/default/800/800';
    }

    res.json({ url: targetUrl });
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
    const { teamId, original_url, submitted_url } = req.body;
    const { execFile } = require('child_process');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, '../maya-ai-service/runner.py');
    
    execFile('python', [scriptPath, original_url, submitted_url], async (error, stdout, stderr) => {
      if (error) {
         console.error("AI Model error:", error, stderr);
         return res.status(500).json({ error: "Scoring failed" });
      }
      try {
        const data = JSON.parse(stdout);
        
        if (data.error) {
           return res.status(500).json({ error: data.error });
        }
        
        const score = data.similarity_score;
        
        if (teamId) {
            await Team.findByIdAndUpdate(teamId, { 
                score: score, 
                finalImageUrl: submitted_url,
                referenceImageUrl: original_url
            });
        }
        
        res.json(data);
      } catch (e) {
        console.error("Failed to parse AI output:", stdout);
        res.status(500).json({ error: "Failed to parse AI output" });
      }
    });
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

    // Upload to S3
    const extension = 'jpg';
    const key = `generated/${uuidv4()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
    });

    await s3.send(command);
    const fullUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.json({ images: [fullUrl] });

  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "Image generation failed: " + err.message });
  }
});

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
